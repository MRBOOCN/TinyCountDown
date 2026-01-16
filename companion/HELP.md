## Bob:TinyCountDown Companion 模块

## TCP命令

### 命令列表

| 命令 | 描述 | 参数 | 预期响应 |
|---------|-------------|------------|-------------------|
| start+ | 启动倒计时 | 无 | 状态更新 |
| start- | 停止倒计时 | 无 | 状态更新 |
| time=\* | 设置倒计时时间 | 秒数 (整数) | 状态更新 |
| fullscreen+ | 启用全屏模式 | 无 | 状态更新 |
| fullscreen- | 禁用全屏模式 | 无 | 状态更新 |
| top+ | 启用始终置顶模式 | 无 | 状态更新 |
| top- | 禁用始终置顶模式 | 无 | 状态更新 |
| Blink+ | 启用闪烁功能 | 无 | 状态更新 |
| Blink- | 禁用闪烁功能 | 无 | 状态更新 |
| mini+ | 显示窗口 | 无 | 状态更新 |
| mini- | 隐藏窗口 | 无 | 状态更新 |
| PING | 心跳 | 无 | PONG |

### 错误处理

| 错误类型 | 描述 | 响应格式 |
|------------|-------------|----------------|
| 连接错误 | 无法连接到TinyCountDown | 日志中的错误消息 |
| 命令错误 | 发送命令失败 | 日志中的错误消息 |
| 状态错误 | 解析状态响应失败 | 日志中的错误消息 |

## 变量

### 可用变量

| 变量 | 描述 |
|----------|-------------|
| countdown_running | 倒计时运行中 |
| countdown_paused | 倒计时已暂停 |
| countdown_remaining_time | 倒计时剩余时间（秒） |
| connection_status | 连接状态 |
| countdown_remaining_time_mmss | 倒计时剩余时间（分:秒） |
| countdown_remaining_time_hhmmss | 倒计时剩余时间（时:分:秒） |
| start_stop_status | 启动/停止状态 |
| top_status | 置顶状态 |
| fullscreen_status | 全屏状态 |
| blink_status | 闪烁状态 |
| port_number | 端口号 |

## 反馈

### 可用反馈

| 反馈 | 描述 |
|----------|-------------|
| countdown_running | 指示倒计时是否正在运行 |
| countdown_paused | 指示倒计时是否已暂停 |
| countdown_complete | 指示倒计时是否已完成 |
| countdown_time_remaining | 以秒为单位显示剩余时间 |
| connection_status | 指示是否已连接到TinyCountDown |
| connection_status_text | 显示详细的连接状态 |
| time_remaining_warning | 当剩余时间低于阈值时指示 |
| countdown_remaining_time_mmss | 以分:秒格式显示倒计时剩余时间 |
| countdown_remaining_time_hhmmss | 以时:分:秒格式显示倒计时剩余时间 |
| countdown_remaining_time | 以秒为单位显示倒计时剩余时间 |
| start_stop_status | 显示启动/停止状态 |
| top_status | 显示置顶功能状态 |
| top_status_text | 以文本形式显示置顶功能状态 |
| fullscreen_status | 显示全屏模式状态 |
| fullscreen_status_text | 以文本形式显示全屏模式状态 |
| blink_status | 显示闪烁效果状态 |
| blink_status_text | 以文本形式显示闪烁效果状态 |
| port_number | 显示当前通信端口号 |

## 配置

### 必填设置

| 设置 | 描述 | 默认值 |
|---------|-------------|---------------|
| 目标IP | TinyCountDown的IP地址 | 127.0.0.1 |
| 目标端口 | TinyCountDown的端口号 | 8080 |
| 重连间隔 | 尝试重新连接的间隔（秒） | 5 |
| 心跳间隔 | 发送心跳的间隔（秒） | 10 |

## 使用方法

1. 配置您的TinyCountDown实例的IP地址和端口
2. 使用提供的操作来控制倒计时
3. 使用提供的反馈来监控倒计时状态
4. 使用提供的变量来显示倒计时信息

## 故障排除

### 常见问题

1. **连接失败**：确保TinyCountDown正在运行，并且IP地址和端口正确
2. **命令不工作**：确保连接已建立，并且命令受您的TinyCountDown版本支持
3. **时间不更新**：确保倒计时正在运行，并且连接稳定

### 日志

检查Companion日志以获取详细的错误消息和调试信息。

### Author

Bob

### Email

MRBOOCN@QQ.COM

### Version

1.6.6
