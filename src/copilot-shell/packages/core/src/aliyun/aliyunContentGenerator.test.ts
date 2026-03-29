/**
 * @license
 * Copyright 2026 Copilot Shell
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AliyunContentGenerator } from './aliyunContentGenerator.js';
import type { GenerateContentParameters } from '@google/genai';
import { Type } from '@google/genai';
import type { ContentGeneratorConfig } from '../core/contentGenerator.js';
import type { Config } from '../config/config.js';

// Mock the Aliyun SDK
vi.mock('@alicloud/sysom20231230', () => ({
  GenerateCopilotResponseRequest: vi.fn(),
  default: vi.fn().mockImplementation(() => ({
    generateCopilotResponseWithOptions: vi.fn().mockResolvedValue({
      body: {
        data: '{"choices": [{"message": {"content": "test response"}}]}',
      },
    }),
  })),
}));

vi.mock('@alicloud/openapi-core', () => ({
  Config: vi.fn(),
  $OpenApiUtil: {
    Config: vi.fn(),
  },
}));

vi.mock('@alicloud/tea-util', () => ({
  RuntimeOptions: vi.fn(),
  $Util: {
    RuntimeOptions: vi.fn(),
  },
}));

vi.mock('./aliyunCredentials.js', () => ({
  loadAliyunCredentials: vi.fn().mockResolvedValue({
    accessKeyId: 'test-key-id',
    accessKeySecret: 'test-key-secret',
  }),
}));

describe('AliyunContentGenerator', () => {
  let generator: AliyunContentGenerator;
  let mockConfig: Config;

  beforeEach(async () => {
    mockConfig = {
      getModel: vi.fn().mockReturnValue('qwen3-coder-plus'),
    } as unknown as Config;

    const contentGeneratorConfig: ContentGeneratorConfig = {
      model: 'qwen3-coder-plus',
    };

    generator = new AliyunContentGenerator(
      {
        accessKeyId: 'test-key-id',
        accessKeySecret: 'test-key-secret',
      },
      contentGeneratorConfig,
      mockConfig,
    );
  });

  describe('convertToAliyunFormat', () => {
    it('should convert tools to correct format with parametersJsonSchema', () => {
      const request: GenerateContentParameters = {
        model: 'qwen3-coder-plus',
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'get_current_weather',
                  description: '当你想查询指定城市的天气时非常有用。',
                  parametersJsonSchema: {
                    type: 'object',
                    properties: {
                      location: {
                        type: 'string',
                        description:
                          '城市或县区，比如北京市、杭州市、余杭区等。',
                      },
                    },
                    required: ['location'],
                  },
                },
              ],
            },
          ],
        },
      };

      // @ts-expect-error - accessing private method for testing
      const result = generator.convertToAliyunFormat(request);

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toEqual({
        type: 'function',
        function: {
          name: 'get_current_weather',
          description: '当你想查询指定城市的天气时非常有用。',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: '城市或县区，比如北京市、杭州市、余杭区等。',
              },
            },
            required: ['location'],
          },
        },
      });
    });

    it('should convert tools to correct format with parameters', () => {
      const request: GenerateContentParameters = {
        model: 'qwen3-coder-plus',
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'get_current_weather',
                  description: '当你想查询指定城市的天气时非常有用。',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      location: {
                        type: Type.STRING,
                        description:
                          '城市或县区，比如北京市、杭州市、余杭区等。',
                      },
                    },
                    required: ['location'],
                  },
                },
              ],
            },
          ],
        },
      };

      // @ts-expect-error - accessing private method for testing
      const result = generator.convertToAliyunFormat(request);

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toEqual({
        type: 'function',
        function: {
          name: 'get_current_weather',
          description: '当你想查询指定城市的天气时非常有用。',
          parameters: {
            type: 'OBJECT',
            properties: {
              location: {
                type: 'STRING',
                description: '城市或县区，比如北京市、杭州市、余杭区等。',
              },
            },
            required: ['location'],
          },
        },
      });
    });

    it('should handle tools without parameters', () => {
      const request: GenerateContentParameters = {
        model: 'qwen3-coder-plus',
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'simple_tool',
                  description: 'A simple tool without parameters',
                },
              ],
            },
          ],
        },
      };

      // @ts-expect-error - accessing private method for testing
      const result = generator.convertToAliyunFormat(request);

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toEqual({
        type: 'function',
        function: {
          name: 'simple_tool',
          description: 'A simple tool without parameters',
          parameters: undefined,
        },
      });
    });

    it('should handle empty tools array', () => {
      const request: GenerateContentParameters = {
        model: 'qwen3-coder-plus',
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        config: {
          tools: [],
        },
      };

      // @ts-expect-error - accessing private method for testing
      const result = generator.convertToAliyunFormat(request);

      expect(result.tools).toBeUndefined();
    });

    it('should handle undefined tools', () => {
      const request: GenerateContentParameters = {
        model: 'qwen3-coder-plus',
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        config: {},
      };

      // @ts-expect-error - accessing private method for testing
      const result = generator.convertToAliyunFormat(request);

      expect(result.tools).toBeUndefined();
    });
  });
});
