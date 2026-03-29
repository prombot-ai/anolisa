/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';
import { ALIYUN_DEFAULT_MODEL } from '@copilot-shell/core';

interface AliyunKeyPromptProps {
  onSubmit: (
    accessKeyId: string,
    accessKeySecret: string,
    model: string,
  ) => void;
  onCancel: () => void;
  defaultAccessKeyId?: string;
  defaultAccessKeySecret?: string;
  defaultModel?: string;
}

export const aliyunCredentialSchema = z.object({
  accessKeyId: z.string().min(1, 'Access Key ID is required'),
  accessKeySecret: z.string().min(1, 'Access Key Secret is required'),
  model: z.string().min(1, 'Model must be a non-empty string').optional(),
});

export type AliyunCredentials = z.infer<typeof aliyunCredentialSchema>;

export function AliyunKeyPrompt({
  onSubmit,
  onCancel,
  defaultAccessKeyId,
  defaultAccessKeySecret,
  defaultModel,
}: AliyunKeyPromptProps): React.JSX.Element {
  const [accessKeyId, setAccessKeyId] = useState(defaultAccessKeyId || '');
  const [accessKeySecret, setAccessKeySecret] = useState(
    defaultAccessKeySecret || '',
  );
  const [model, setModel] = useState(defaultModel || ALIYUN_DEFAULT_MODEL);
  const [currentField, setCurrentField] = useState<
    'accessKeyId' | 'accessKeySecret' | 'model'
  >('accessKeyId');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Update state when props change (for async loading of saved credentials)
  useEffect(() => {
    if (defaultAccessKeyId) {
      setAccessKeyId(defaultAccessKeyId);
    }
  }, [defaultAccessKeyId]);

  useEffect(() => {
    if (defaultAccessKeySecret) {
      setAccessKeySecret(defaultAccessKeySecret);
    }
  }, [defaultAccessKeySecret]);

  useEffect(() => {
    if (defaultModel) {
      setModel(defaultModel);
    }
  }, [defaultModel]);

  const validateAndSubmit = () => {
    setValidationError(null);

    try {
      const validated = aliyunCredentialSchema.parse({
        accessKeyId: accessKeyId.trim(),
        accessKeySecret: accessKeySecret.trim(),
        model: model.trim() || undefined,
      });

      onSubmit(
        validated.accessKeyId,
        validated.accessKeySecret,
        validated.model || ALIYUN_DEFAULT_MODEL,
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        setValidationError(
          t('Invalid credentials: {{errorMessage}}', { errorMessage }),
        );
      } else {
        setValidationError(t('Failed to validate credentials'));
      }
    }
  };

  // Mask the secret key for display
  const maskedSecret = accessKeySecret
    ? '*'.repeat(accessKeySecret.length)
    : '';

  useKeypress(
    (key) => {
      // Handle escape
      if (key.name === 'escape') {
        onCancel();
        return;
      }

      // Handle Enter key
      if (key.name === 'return') {
        if (currentField === 'accessKeyId') {
          // Allow empty accessKeyId to navigate to next field
          setCurrentField('accessKeySecret');
          return;
        } else if (currentField === 'accessKeySecret') {
          setCurrentField('model');
          return;
        } else if (currentField === 'model') {
          // Only validate and submit when all required fields are filled
          if (accessKeyId.trim() && accessKeySecret.trim()) {
            validateAndSubmit();
          } else if (!accessKeyId.trim()) {
            setCurrentField('accessKeyId');
          } else if (!accessKeySecret.trim()) {
            setCurrentField('accessKeySecret');
          }
        }
        return;
      }

      // Handle Tab key for field navigation
      if (key.name === 'tab') {
        if (currentField === 'accessKeyId') {
          setCurrentField('accessKeySecret');
        } else if (currentField === 'accessKeySecret') {
          setCurrentField('model');
        } else if (currentField === 'model') {
          setCurrentField('accessKeyId');
        }
        return;
      }

      // Handle arrow keys for field navigation
      if (key.name === 'up') {
        if (currentField === 'accessKeySecret') {
          setCurrentField('accessKeyId');
        } else if (currentField === 'model') {
          setCurrentField('accessKeySecret');
        }
        return;
      }

      if (key.name === 'down') {
        if (currentField === 'accessKeyId') {
          setCurrentField('accessKeySecret');
        } else if (currentField === 'accessKeySecret') {
          setCurrentField('model');
        }
        return;
      }

      // Handle backspace/delete
      if (key.name === 'backspace' || key.name === 'delete') {
        if (currentField === 'accessKeyId') {
          setAccessKeyId((prev: string) => prev.slice(0, -1));
        } else if (currentField === 'accessKeySecret') {
          setAccessKeySecret((prev: string) => prev.slice(0, -1));
        } else if (currentField === 'model') {
          setModel((prev: string) => prev.slice(0, -1));
        }
        return;
      }

      // Handle paste mode
      if (key.paste && key.sequence) {
        let cleanInput = key.sequence
          .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // eslint-disable-line no-control-regex
          .replace(/\[200~/g, '')
          .replace(/\[201~/g, '')
          .replace(/^\[|~$/g, '');

        cleanInput = cleanInput
          .split('')
          .filter((ch) => ch.charCodeAt(0) >= 32)
          .join('');

        if (cleanInput.length > 0) {
          if (currentField === 'accessKeyId') {
            setAccessKeyId((prev: string) => prev + cleanInput);
          } else if (currentField === 'accessKeySecret') {
            setAccessKeySecret((prev: string) => prev + cleanInput);
          } else if (currentField === 'model') {
            setModel((prev: string) => prev + cleanInput);
          }
        }
        return;
      }

      // Handle regular character input
      if (key.sequence && !key.ctrl && !key.meta) {
        const cleanInput = key.sequence
          .split('')
          .filter((ch) => ch.charCodeAt(0) >= 32)
          .join('');

        if (cleanInput.length > 0) {
          if (currentField === 'accessKeyId') {
            setAccessKeyId((prev: string) => prev + cleanInput);
          } else if (currentField === 'accessKeySecret') {
            setAccessKeySecret((prev: string) => prev + cleanInput);
          } else if (currentField === 'model') {
            setModel((prev: string) => prev + cleanInput);
          }
        }
      }
    },
    { isActive: true },
  );

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>
        {t('Aliyun AK/SK Configuration')}
      </Text>
      {validationError && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{validationError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text>
          {t(
            'Please enter your Aliyun Access Key credentials. You can get them from',
          )}{' '}
          <Text color={Colors.AccentBlue}>
            https://ram.console.aliyun.com/manage/ak
          </Text>
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={20}>
          <Text
            color={
              currentField === 'accessKeyId' ? Colors.AccentBlue : Colors.Gray
            }
          >
            {t('Access Key ID:')}
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'accessKeyId' ? '> ' : '  '}
            {accessKeyId || ' '}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={20}>
          <Text
            color={
              currentField === 'accessKeySecret'
                ? Colors.AccentBlue
                : Colors.Gray
            }
          >
            {t('Access Key Secret:')}
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'accessKeySecret' ? '> ' : '  '}
            {maskedSecret || ' '}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={20}>
          <Text
            color={currentField === 'model' ? Colors.AccentBlue : Colors.Gray}
          >
            {t('Model:')}
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'model' ? '> ' : '  '}
            {model}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          {t('Press Enter to continue, Tab/↑↓ to navigate, Esc to cancel')}
        </Text>
      </Box>
    </Box>
  );
}
