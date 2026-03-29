#!/usr/bin/env python3
"""
OpenClaw 配置脚本 — 钉钉频道 + 百炼 Qwen 模型
自动写入 ~/.openclaw/openclaw.json
"""

import json
import argparse
import os


# ─── 工具函数 ───────────────────────────────────────────────

CONFIG_PATH = os.path.expanduser("~/.openclaw/openclaw.json")


def deep_merge(base, override):
    """深度合并两个字典，override 优先，base 中独有的字段保留"""
    result = dict(base)
    for key, val in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(val, dict):
            result[key] = deep_merge(result[key], val)
        else:
            result[key] = val
    return result


# ─── 配置构建 ───────────────────────────────────────────────

def build_config(args):
    """根据参数构建完整配置字典"""

    model_id = args.model_id
    model_ref = f"bailian/{model_id}"

    config = {
        "plugins": {
            "enabled": True,
            "allow": ["dingtalk"]
        },
        "models": {
            "mode": "merge",
            "providers": {
                "bailian": {
                    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                    "apiKey": args.dashscope_api_key,
                    "api": "openai-completions",
                    "models": [{
                        "id": model_id,
                        "name": "qwen3-max-thinking",
                        "reasoning": False,
                        "input": ["text"],
                        "cost": {
                            "input": 0, "output": 0,
                            "cacheRead": 0, "cacheWrite": 0
                        },
                        "contextWindow": 262144,
                        "maxTokens": 65536
                    }]
                }
            }
        },
        "agents": {
            "defaults": {
                "model": {
                    "primary": model_ref
                },
                "models": {
                    model_ref: {
                        "alias": "qwen3-max-thinking"
                    }
                },
                "maxConcurrent": 4,
                "subagents": {
                    "maxConcurrent": 8
                }
            }
        },
        "channels": {
            "dingtalk": build_dingtalk_channel(args)
        },
        "messages": {
            "ackReactionScope": "group-mentions"
        },
        "commands": {
            "native": "auto",
            "nativeSkills": "auto",
            "restart": True,
            "ownerDisplay": "raw"
        },
        "session": {
            "dmScope": "per-channel-peer"
        },
        "gateway": {
            "mode": "local"
        },
        "skills": {
            "load": {
                "extraDirs": [
                    "/usr/share/anolisa/skills"
                ]
            }
        }
    }

    return config


def build_dingtalk_channel(args):
    """构建钉钉频道配置"""
    ch = {
        "enabled": True,
        "clientId": args.dingtalk_client_id,
        "clientSecret": args.dingtalk_client_secret,
        "dmPolicy": args.dm_policy,
        "groupPolicy": args.group_policy,
        "debug": False,
        "messageType": args.message_type,
        "allowFrom": ["*"],
    }

    # 可选字段 —— 有值才写入
    if args.dingtalk_robot_code:
        ch["robotCode"] = args.dingtalk_robot_code
    if args.dingtalk_corp_id:
        ch["corpId"] = args.dingtalk_corp_id
    if args.dingtalk_agent_id:
        ch["agentId"] = args.dingtalk_agent_id

    # 卡片模式参数
    if args.message_type == "card":
        if args.card_template_id:
            ch["cardTemplateId"] = args.card_template_id
        ch["cardTemplateKey"] = args.card_template_key

    return ch


# ─── 写入配置 ───────────────────────────────────────────────

def apply_config(config):
    """直接读写 JSON 文件，避免多次启动 openclaw 子进程"""

    print("\n--- 写入 OpenClaw 配置 ---\n")

    # 读取现有配置（保留 meta、plugins 等已有字段）
    existing = {}
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            existing = json.load(f)

    # 深度合并：现有配置优先保留，新配置覆盖对应字段
    merged = deep_merge(existing, config)

    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
        f.write("\n")

    for key in config:
        print(f"  [OK]   {key}")

    print("\n--- 配置写入完成 ---")


# ─── 主入口 ─────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="OpenClaw 配置 — 钉钉 + 百炼 Qwen"
    )

    # 钉钉必填
    p.add_argument("--dingtalk-client-id", required=True,
                    help="钉钉应用 AppKey")
    p.add_argument("--dingtalk-client-secret", required=True,
                    help="钉钉应用 AppSecret")

    # 钉钉可选
    p.add_argument("--dingtalk-robot-code", default="",
                    help="机器人代码（通常与 AppKey 相同）")
    p.add_argument("--dingtalk-corp-id", default="",
                    help="企业 ID")
    p.add_argument("--dingtalk-agent-id", default="",
                    help="应用 ID")

    # 百炼必填
    p.add_argument("--dashscope-api-key", required=True,
                    help="百炼 DashScope API Key")

    # 模型可选
    p.add_argument("--model-id", default="qwen3-max-2026-01-23",
                    help="模型 ID（默认 qwen3-max-2026-01-23）")

    # 策略
    p.add_argument("--dm-policy", default="open",
                    choices=["open", "pairing", "allowlist"],
                    help="私聊策略")
    p.add_argument("--group-policy", default="open",
                    choices=["open", "allowlist"],
                    help="群聊策略")

    # 消息类型
    p.add_argument("--message-type", default="markdown",
                    choices=["markdown", "card"],
                    help="消息类型")
    p.add_argument("--card-template-id", default="",
                    help="AI 卡片模板 ID（仅 card 模式）")
    p.add_argument("--card-template-key", default="content",
                    help="卡片内容字段 Key（默认 content）")

    args = p.parse_args()

    # 构建 + 写入
    config = build_config(args)
    apply_config(config)

    print("\n下一步：运行 'openclaw gateway restart' 启动服务。")


if __name__ == "__main__":
    main()
