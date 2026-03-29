# OpenClaw 配置踩坑与排查手册

所有问题均来自真实安装经验，每条都附有根因分析和修复方法。

---

## 坑 1：网关 60 秒超时 — `gateway.mode` 缺失

**现象**
```
Timed out after 60s waiting for gateway port 18789 to become healthy.
```
或
```
Restarted systemd service: openclaw-gateway.service
```
端口始终不监听，进程启动后立即退出。

**根因**

`~/.openclaw/openclaw.json` 的 `gateway` 节缺少 `"mode": "local"`。OpenClaw 网关启动时强制检查此字段，缺失则直接中止，日志：
```
Gateway start blocked: set gateway.mode=local (current: unset) or pass --allow-unconfigured.
```

`openclaw doctor --fix` 只写入 `gateway.auth.token`，**不会写 `gateway.mode`**，这是常见误解。

**排查方法**
```bash
# 前台运行看实际报错
openclaw gateway run --verbose 2>&1 | head -5
```

**修复**

确保 `~/.openclaw/openclaw.json` 中存在：
```json
"gateway": {
  "mode": "local",
  "auth": {
    "mode": "token",
    "token": "..."
  }
}
```

配置脚本 `scripts/configure_openclaw_dingtalk.py` 已自动写入 `gateway.mode`，手动配置时必须自行补充。

---

## 坑 2：`plugins` 字段写入不完整导致插件不加载

**现象**

钉钉机器人无响应，`openclaw gateway status` 未显示钉钉频道在线。

**根因**

openclaw 的 `plugins` 节有四个字段，职责不同：

```json
"plugins": {
  "enabled": true,          // 顶层开关，缺失则插件系统关闭
  "allow": ["dingtalk"],    // 白名单，缺失则所有插件被屏蔽
  "entries": {              // 由 openclaw plugins install 自动写入
    "dingtalk": { "enabled": true }
  },
  "installs": { ... }       // 安装元数据，由系统维护
}
```

`enabled` 和 `allow` 缺少任意一个，插件不会加载。

旧版脚本（使用 `openclaw config set` 写配置）的逻辑是：发现 `plugins` 节已存在就跳过，导致 `enabled`/`allow` 永远写不进去。

**修复**

直接编辑 `~/.openclaw/openclaw.json`，确保 `plugins` 同时包含 `enabled: true` 和 `allow: ["dingtalk"]`，同时保留现有的 `entries` 和 `installs` 数据。

---

## 坑 3：用 `openclaw config set` 写配置又慢又不可靠

**现象**

配置脚本执行很慢（5-10 秒），部分字段未写入。

**根因**

每次调用 `openclaw config set` 都会启动一个新的 Node.js 进程，冷启动耗时约 300ms/次。12+ 条命令串行执行总计 4-6 秒。

更严重的是，`set_config_tree` 逻辑会逐层检查节点，遇到已有内容就停止，导致子节点字段（如 `plugins.enabled`）在父节点存在时永远写不进去。

**正确做法**

直接读写 `~/.openclaw/openclaw.json`，用 `deep_merge` 函数合并，速度从秒级降到毫秒级，且不会跳过任何字段。`scripts/configure_openclaw_dingtalk.py` 已采用此方案。

---

## 坑 4：`channels.dingtalk.allowFrom` 缺失

**现象**

网关启动正常，但钉钉消息完全没有响应。

**修复**

确认 `~/.openclaw/openclaw.json` 的 `channels.dingtalk` 节包含：
```json
"allowFrom": ["*"]
```

---

## 坑 5：`openclaw doctor --fix` 触发 doctor 向导卡住

**现象**

执行 `openclaw doctor --fix` 后出现交互式向导界面，等待用户输入，脚本卡住。

**说明**

`doctor --fix` 是交互式命令，会引导用户完成初始设置。如果配置文件已完整（通过脚本写入），可以按照提示快速跳过，或直接按 Ctrl+C 后手动检查 `gateway.mode` 是否存在。

初始化完成的标志是 `~/.openclaw/openclaw.json` 中出现 `gateway.auth.token` 和 `wizard.lastRunAt`。

---

## 坑 6：卸载后 openclaw 二进制残留

**现象**
```bash
npm remove openclaw
which openclaw  # 仍然返回 /usr/local/bin/openclaw
```

**根因**

`/usr/local/bin/openclaw` 是指向 `/usr/local/lib/node_modules/openclaw/` 的符号链接，`npm remove` 未能清理。

**修复**
```bash
rm -f /usr/local/bin/openclaw
rm -rf /usr/local/lib/node_modules/openclaw
which openclaw  # 应返回 "no openclaw"
```

---

## 坑 7：插件半安装状态

**现象**

`openclaw plugins list` 显示 dingtalk 插件报错，或安装过程中断。

**修复**
```bash
cd ~/.openclaw/extensions/dingtalk
rm -rf node_modules package-lock.json
NPM_CONFIG_REGISTRY=https://registry.npmmirror.com npm install
```

---

## 快速排查流程

出现问题时，按顺序检查：

```bash
# 1. 检查进程是否存活
ps aux | grep openclaw-gateway | grep -v grep

# 2. 检查端口是否监听
ss -tlnp | grep 18789

# 3. 前台运行看实际报错
openclaw gateway run --verbose 2>&1 | head -10

# 4. 检查关键配置字段
python3 -c "
import json
d = json.load(open('/root/.openclaw/openclaw.json'))
print('gateway.mode:', d.get('gateway', {}).get('mode', '【缺失！】'))
print('plugins.enabled:', d.get('plugins', {}).get('enabled', '【缺失！】'))
print('plugins.allow:', d.get('plugins', {}).get('allow', '【缺失！】'))
print('dingtalk.allowFrom:', d.get('channels', {}).get('dingtalk', {}).get('allowFrom', '【缺失！】'))
"
```
