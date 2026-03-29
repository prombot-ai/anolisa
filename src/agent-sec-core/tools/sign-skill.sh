#!/bin/bash
#
# Skill Manifest and Signature Generator (Bash version)
#
# This script generates Manifest.json and .skill.sig files for skill directories.
#
# Usage:
#   Single mode: ./sign-skill.sh <skill_dir> [--skill-name NAME] [--force]
#   Batch  mode: ./sign-skill.sh --batch <parent_dir> [--force]
#
# In batch mode, <parent_dir> is scanned and every immediate subdirectory is
# treated as an individual skill directory to sign.
#
# Environment Variables:
#   GPG_PRIVATE_KEY  - ASCII-armored GPG private key used for signing.
#                      The key will be imported into the local GPG keyring
#                      automatically before signing. Typically provided in CI/CD
#                      environments where the keyring is not pre-configured.
#

set -e

MANIFEST_FILENAME="Manifest.json"
SIGNATURE_FILENAME=".skill.sig"
HASH_ALGORITHM="SHA256"
MANIFEST_VERSION="0.1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to compute SHA256 hash of a file
compute_file_hash() {
    local file_path="$1"
    if command -v sha256sum &> /dev/null; then
        sha256sum "$file_path" | awk '{print $1}'
    else
        shasum -a 256 "$file_path" | awk '{print $1}'
    fi
}

# Function to generate manifest JSON
generate_manifest() {
    local skill_dir="$1"
    local skill_name="$2"
    local files_array=""
    local first=true

    # Find all files, compute hashes, build JSON array
    while IFS= read -r -d '' file; do
        local rel_path="${file#$skill_dir/}"
        local basename=$(basename "$rel_path")

        # Skip excluded files
        if [[ "$basename" == "$MANIFEST_FILENAME" ]] || [[ "$basename" == "$SIGNATURE_FILENAME" ]]; then
            continue
        fi

        # Skip hidden files and files in hidden directories
        local skip=false
        local check_path="$rel_path"
        while [[ "$check_path" != "." ]] && [[ "$check_path" != "/" ]] && [[ -n "$check_path" ]]; do
            local part=$(basename "$check_path")
            if [[ "$part" == .* ]]; then
                skip=true
                break
            fi
            check_path=$(dirname "$check_path")
        done

        if [[ "$skip" == true ]]; then
            continue
        fi

        local file_hash=$(compute_file_hash "$file")

        # Add comma if not first element
        if [[ "$first" == true ]]; then
            first=false
        else
            files_array+=","
        fi

        # Use jq to safely encode the path and hash into JSON
        local file_entry
        file_entry=$(jq -n --arg path "$rel_path" --arg hash "$file_hash" '{path: $path, hash: $hash}')
        files_array+="$file_entry"
    done < <(find "$skill_dir" -type f -print0 | sort -z)

    local created_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Use jq to safely construct the entire manifest JSON
    jq -n \
        --arg version "$MANIFEST_VERSION" \
        --arg skill_name "$skill_name" \
        --arg algorithm "$HASH_ALGORITHM" \
        --arg created_at "$created_at" \
        --argjson files "[$files_array]" \
        '{version: $version, skill_name: $skill_name, algorithm: $algorithm, created_at: $created_at, files: $files}'
}

# Function to sign manifest using GPG
sign_manifest() {
    local manifest_path="$1"
    local signature_path="$2"

    local cmd=(gpg --batch --yes --armor --detach-sign --output "$signature_path")

    # Add passphrase if provided via environment variable
    if [[ -n "$GPG_PASSPHRASE" ]]; then
        cmd+=(--pinentry-mode loopback --passphrase "$GPG_PASSPHRASE")
    fi

    cmd+=("$manifest_path")

    if ! "${cmd[@]}" 2>/dev/null; then
        echo -e "${RED}ERROR: Failed to sign manifest${NC}" >&2
        return 1
    fi

    return 0
}

# Function to show usage
show_usage() {
    echo "Usage:"
    echo "  $0 <skill_dir> [--skill-name NAME] [--force]"
    echo "  $0 --batch <parent_dir> [--force]"
    echo ""
    echo "Arguments:"
    echo "  skill_dir           Path to the skill directory"
    echo "  parent_dir          Path to a directory whose subdirectories are skill directories"
    echo ""
    echo "Options:"
    echo "  --batch             Batch mode: sign every subdirectory under parent_dir"
    echo "  --skill-name NAME   Skill name (defaults to directory name)"
    echo "  --force             Overwrite existing manifest and signature files"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Prerequisites:"
    echo "  PGP private key must be configured for signing. Ensure you have"
    echo "  a valid GPG key pair with 'gpg --list-secret-keys'"
    echo ""
    echo "Note:"
    echo "  Uses the default GPG key (first secret key in the keyring)."
    echo "  Set the default key with: gpg --default-key KEY_ID"
}

# Sign a single skill directory. Accepts: skill_dir, skill_name, force
sign_single_skill() {
    local skill_dir="$1"
    local skill_name="$2"
    local force="$3"

    # Resolve absolute path
    skill_dir=$(cd "$skill_dir" 2>/dev/null && pwd) || true

    if [[ ! -d "$skill_dir" ]]; then
        echo -e "${RED}ERROR: Skill directory does not exist: $skill_dir${NC}" >&2
        return 1
    fi

    # Set default skill name
    if [[ -z "$skill_name" ]]; then
        skill_name=$(basename "$skill_dir")
    fi

    local manifest_path="$skill_dir/$MANIFEST_FILENAME"
    local signature_path="$skill_dir/$SIGNATURE_FILENAME"

    # Check if files already exist
    if [[ "$force" == false ]]; then
        if [[ -f "$manifest_path" ]]; then
            echo -e "${YELLOW}WARNING: $MANIFEST_FILENAME already exists in $skill_name. Use --force to overwrite.${NC}"
            return 1
        fi
        if [[ -f "$signature_path" ]]; then
            echo -e "${YELLOW}WARNING: $SIGNATURE_FILENAME already exists in $skill_name. Use --force to overwrite.${NC}"
            return 1
        fi
    fi

    echo "Generating manifest for skill: $skill_name"
    echo "Skill directory: $skill_dir"

    # Generate and save manifest
    generate_manifest "$skill_dir" "$skill_name" > "$manifest_path"
    echo -e "  ${GREEN}[CREATED]${NC} $MANIFEST_FILENAME"

    # Sign manifest
    if sign_manifest "$manifest_path" "$signature_path"; then
        echo -e "  ${GREEN}[CREATED]${NC} $SIGNATURE_FILENAME"
    else
        echo -e "  ${RED}[ERROR]${NC} Failed to create $SIGNATURE_FILENAME"
        return 1
    fi

    return 0
}

# Main function
main() {
    local skill_dir=""
    local skill_name=""
    local force=false
    local batch=false
    local batch_dir=""

    # Import GPG private key from environment variable if provided
    if [[ -n "$GPG_PRIVATE_KEY" ]]; then
        # Disable shell tracing to avoid exposing private key in logs
        { set +x; } 2>/dev/null
        if ! gpg --list-secret-keys 2>/dev/null | grep -q "sec"; then
            echo "Importing GPG private key from environment..."
            echo "$GPG_PRIVATE_KEY" | gpg --batch --import
            # Set ultimate trust for the imported key
            local fpr
            fpr=$(gpg --list-secret-keys --with-colons | grep fpr | head -1 | cut -d':' -f10)
            echo "$fpr:6:" | gpg --import-ownertrust
            echo "GPG private key imported and trusted successfully"
        fi
        set -x 2>/dev/null || true
    fi

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --batch)
                batch=true
                batch_dir="$2"
                shift 2
                ;;
            --skill-name)
                skill_name="$2"
                shift 2
                ;;
            --force)
                force=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                echo -e "${RED}ERROR: Unknown option $1${NC}" >&2
                show_usage
                exit 1
                ;;
            *)
                if [[ -z "$skill_dir" ]]; then
                    skill_dir="$1"
                else
                    echo -e "${RED}ERROR: Multiple skill directories specified${NC}" >&2
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # Batch mode
    if [[ "$batch" == true ]]; then
        if [[ -z "$batch_dir" ]]; then
            echo -e "${RED}ERROR: --batch requires a parent directory${NC}" >&2
            show_usage
            exit 1
        fi

        batch_dir=$(cd "$batch_dir" 2>/dev/null && pwd) || true
        if [[ ! -d "$batch_dir" ]]; then
            echo -e "${RED}ERROR: Batch directory does not exist: $batch_dir${NC}" >&2
            exit 1
        fi

        echo "Batch signing skills under: $batch_dir"
        echo ""

        local failed=0
        local total=0
        for subdir in "$batch_dir"/*/; do
            [[ -d "$subdir" ]] || continue
            total=$((total + 1))
            if ! sign_single_skill "$subdir" "" "$force"; then
                failed=$((failed + 1))
            fi
            echo ""
        done

        echo "Batch complete: $((total - failed))/$total skills signed successfully."
        if [[ $failed -gt 0 ]]; then
            echo -e "${RED}$failed skill(s) failed to sign.${NC}"
            exit 1
        fi

        echo "Done!"
        exit 0
    fi

    # Single mode
    if [[ -z "$skill_dir" ]]; then
        echo -e "${RED}ERROR: Skill directory not specified${NC}" >&2
        show_usage
        exit 1
    fi

    if ! sign_single_skill "$skill_dir" "$skill_name" "$force"; then
        exit 1
    fi

    echo ""
    echo "Done!"
}

main "$@"
