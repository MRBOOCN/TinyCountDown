# Bitfocus Companion Module for TinyCountdown

这是一个专为 [Bitfocus Companion](https://bitfocus.no/companion) 开发的模块，用于控制 **TinyCountdown** 倒计时应用程序。

## 功能特性

### 支持的功能

- ✅ **倒计时控制**
  - 开始/停止/暂停倒计时（支持切换/单独开始/单独停止）
  - 重置倒计时
  - 设置自定义时间（时/分/秒）
  - 增加/减少时间（合并为一个动作）
  
- ✅ **显示控制**
  - 切换/开启/关闭文本闪烁模式
  - 切换/开启/关闭窗口置顶
  - 切换/开启/关闭全屏模式
  - 切换/显示/隐藏窗口可见性（迷你模式）
  
- ✅ **输出控制**
  - 设置输出分辨率：Default、1366x768、1920x1080、2560x1440、3840x2160
  - 切换/开启/关闭 NDI 视频输出
  
- ✅ **状态监控**
  - 实时获取倒计时状态
  - WebSocket 心跳保持连接
  - 自动重连机制（指数退避，间隔 200ms/500ms/1000ms/2000ms/5000ms）
  - Token 认证与自动续期
  - 密码修改后自动重新认证
  
- ✅ **变量追踪**
  - 运行状态
  - 暂停状态
  - 剩余时间
  - 总时间
  - 格式化时间显示
  - 分辨率索引及可读标签
  - NDI 输出状态
  - 各种开关状态
  
- ✅ **反馈条件**
  - 运行状态反馈
  - 暂停状态反馈
  - 时间阈值警告
  - 显示模式反馈
  - 分辨率状态反馈
  - NDI 输出状态反馈
  
- ✅ **预设按钮**
  - 开始/停止切换按钮（运行时绿色背景黑色文字，停止时红色背景白色文字）
  - 重置按钮
  - 时间调整按钮组
  - 显示控制按钮组
  - 分辨率预设按钮组（含动态分辨率标签和 5 个固定分辨率按钮）
  - NDI 切换按钮

## 系统要求

- **Companion**: v2.0 或更高版本
- **Node.js**: v18 或更高版本
- **TinyCountdown**: v1.6.7 或更高版本

## 安装方法

### 方法一：开发模式安装

1. **克隆模块到本地**
   ```bash
   cd d:\Desktop\TinyCountdown v1.6.6 v2-5\companion-module-tinycountdown
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **打包模块**
   ```bash
   npx companion-module-build
   ```

4. **导入到 Companion**
   - 打开 Companion 网页界面
   - 进入 Connections 页面
   - 点击 "Add Beta Module" 或 "Add Stable Module"
   - 选择生成的 `.companion-module.zip` 文件

### 方法二：手动安装

1. 将编译后的模块文件夹复制到 Companion 的模块目录：
   - Windows: `%APPDATA%\companion\modules\`
   - macOS: `~/Library/Application Support/companion/modules/`
   - Linux: `~/.config/companion/modules/`

2. 重启 Companion

## 配置说明

在 Companion 的 Connections 页面添加 TinyCountdown 模块后，需要配置以下参数：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| Host | TinyCountdown 服务器的 IP 地址或主机名 | localhost |
| Port | WebSocket 端口号（0 = 自动检测） | 0 |
| Auto Reconnect | 断线后自动重连 | ✓ |
| Debug Messages | 记录所有消息日志 | ✗ |
| Reset Variables on Connect | 连接时重置变量 | ✓ |

## 使用指南

### Actions（动作）

#### 倒计时控制

1. **开始/停止** - 开始/停止倒计时（带下拉选项：切换/开始/停止）
2. **重置倒计时** - 重置倒计时到初始时间
3. **设置时间** - 设置倒计时时间（小时、分钟、秒）
4. **时间+/-** - 增加/减少时间（带下拉选项：增加/减少，可设置时/分/秒）

#### 显示控制

5. **闪烁模式** - 闪烁模式（带下拉选项：切换/开启/关闭）
6. **置顶** - 窗口置顶（带下拉选项：切换/开启/关闭）
7. **全屏模式** - 全屏模式（带下拉选项：切换/开启/关闭）
8. **显示/隐藏** - 窗口可见性（带下拉选项：切换/显示/隐藏）

#### 输出控制

9. **分辨率** - 设置输出分辨率（Default / 1366x768 / 1920x1080 / 2560x1440 / 3840x2160）
10. **NDI 输出** - NDI 视频输出（带下拉选项：切换/开启/关闭）

### Feedbacks（反馈）

1. **开始/停止** - 倒计时时改变按钮样式（绿色背景 `#3FD63F` + 黑色文字）
2. **停止状态** - 未运行时改变按钮样式（红色背景 `#FF0000` + 白色文字）
3. **运行状态** - 根据运行状态改变按钮样式
4. **暂停状态** - 根据暂停状态改变按钮样式
5. **闪烁模式** - 闪烁模式启用时改变样式（黄色）
6. **窗口置顶** - 置顶启用时改变样式
7. **全屏模式** - 全屏时改变样式
8. **窗口可见** - 根据窗口可见性改变样式（绿色）
9. **分辨率状态** - 当前分辨率与指定值匹配时改变样式（绿色）
10. **NDI 输出** - NDI 启用时改变样式（绿色）
11. **剩余时间** - 时间低于阈值时改变样式（红色警告，可配置阈值）

### Variables（变量）

可在按钮文本中使用的变量：

- `$(Tinycountdown:running)` - 运行状态（true/false）
- `$(Tinycountdown:paused)` - 暂停状态（true/false）
- `$(Tinycountdown:remainingTime)` - 剩余秒数
- `$(Tinycountdown:remainingTimeFormatted)` - 格式化剩余时间（HH:MM:SS）
- `$(Tinycountdown:totalTime)` - 总秒数
- `$(Tinycountdown:time)` - 格式化时间显示（MM:SS）
- `$(Tinycountdown:blink)` - 闪烁状态（true/false）
- `$(Tinycountdown:top)` - 置顶状态（true/false）
- `$(Tinycountdown:fullscreen)` - 全屏状态（true/false）
- `$(Tinycountdown:windowVisible)` - 窗口可见状态（true/false）
- `$(Tinycountdown:port)` - 服务器端口号
- `$(Tinycountdown:resolution)` - 分辨率索引（-1/0/1/2/3）
- `$(Tinycountdown:resolutionLabel)` - 分辨率可读标签（如 `1920 x 1080`）
- `$(Tinycountdown:ndi)` - NDI 输出状态（true/false）

### Presets（预设）

模块内置了常用预设按钮：

1. **开始/停止切换** - 开始/停止切换按钮（运行时绿色背景黑色文字，停止时红色背景白色文字）
2. **重置** - 重置按钮
3. **时间调整预设** - 快速增加/减少时间的预设按钮
4. **闪烁切换** - 闪烁切换按钮（带状态灯）
5. **置顶切换** - 置顶切换按钮（带状态灯）
6. **全屏切换** - 全屏切换按钮（带状态灯）
7. **窗口切换** - 窗口显示切换按钮（带状态灯）
8. **分辨率预设组**：
   - **动态标签按钮**：文本为 `$(Tinycountdown:resolutionLabel)`，实时显示当前分辨率
   - **Default** - 恢复默认分辨率
   - **1366x768** - 分辨率按钮（12pt 字体）
   - **1920x1080** - 分辨率按钮（12pt 字体）
   - **2560x1440** - 分辨率按钮（12pt 字体）
   - **3840x2160** - 分辨率按钮（12pt 字体）
9. **NDI 切换** - NDI 输出切换按钮（带状态灯）

## 技术架构

### WebSocket 通信

模块通过 WebSocket 与 TinyCountdown 服务器通信：

- **协议**: `ws://host:port/ws?token=<token>`
- **心跳**: 每 10 秒发送 PING，期望收到 PONG
- **连接超时**: 连接建立超时 5 秒，防止永久挂起
- **认证**: 通过用户名/密码获取 Token，Token 存储在会话中，连接时作为 URL 参数传递
- **重连**: 指数退避策略，间隔 [200, 500, 1000, 2000, 5000]ms；Token 有效时快速重连（跳过认证）；Token 失效时自动重新认证（最多 2 次 Token 重试）
- **消息格式**: 
  - 命令：纯文本或带参数的命令（如 `start`, `Resolution_Set?index=1`）
  - 响应：JSON 格式状态数据

### 支持的命令格式

```javascript
// 倒计时控制
'start'         // 开始倒计时
'stop'          // 停止倒计时
'reset'         // 重置倒计时

// 时间设置
'time=300'      // 设置为 300 秒
'timeAdd=60'    // 增加 60 秒
'timeSubtract=30' // 减少 30 秒

// 显示控制
'Blink_Toggle'     // 切换闪烁
'Blink_Enabled'    // 开启闪烁
'Blink_Disabled'   // 关闭闪烁
'Top_Toggle'       // 切换置顶
'Top_Enabled'      // 开启置顶
'Top_Disabled'     // 关闭置顶
'Fullscreen_Toggle'  // 切换全屏
'Fullscreen_Enabled' // 开启全屏
'Fullscreen_Disabled' // 关闭全屏
'Show_Toggle'      // 切换窗口可见性
'Show_Enabled'     // 显示窗口
'Show_Disabled'    // 隐藏窗口

// 输出控制
'Resolution_Set?index=1'  // 设置分辨率为 1920x1080（-1=Default, 0=1366x768, 1=1920x1080, 2=2560x1440, 3=3840x2160）
'NDI_Set?enabled=true'   // 开启 NDI 输出
'NDI_Set?enabled=false'  // 关闭 NDI 输出

// 其他命令
'PING'           // 心跳
```

### 状态响应格式

```json
{
  "type": "status",
  "data": {
    "running": true,
    "paused": false,
    "remainingTime": 300,
    "remainingTimeMs": 300000,
    "totalTime": 300,
    "blink": false,
    "top": true,
    "fullscreen": false,
    "windowVisible": true,
    "resolution": 1,
    "resolutionLabel": "1920 x 1080",
    "ndi": false,
    "port": 8080
  }
}
```

### 数据处理

- **数据标准化**：自动识别并统一不同格式的状态数据
- **数据验证**：验证数据类型和逻辑正确性（如剩余时间不能为负数）
- **向下取整**：时间数据使用 Math.floor() 向下取整，避免四舍五入
- **单一数据流**：所有状态更新来自软件端的主动推送，无需轮询
- **自动修正**：检测到矛盾数据时自动修正（如运行时自动取消暂停状态）
- **Token 管理**：密码修改后立即失效所有 Token，关闭所有 WebSocket 连接，模块收到关闭代码 1008 后自动重新认证
- **密码安全**：密码存储在 Companion 设备密钥库中，模块初始化时从密钥库读取，不依赖配置文件

## 故障排除

### 无法连接

1. 确认 TinyCountdown 应用程序正在运行
2. 检查 Web 服务器是否已启动
3. 验证主机和端口配置是否正确
4. 检查防火墙设置

### 状态不更新

1. 检查 WebSocket连接状态
2. 查看调试日志（启用 Debug Messages）
3. 尝试手动请求状态更新（Get Status 动作）

### 变量不更新

1. 确认已成功建立 WebSocket连接
2. 检查是否启用了 "Reset Variables on Connect"
3. 查看 Companion 日志中的错误信息

### 分辨率控制无效

1. 确认 TinyCountdown 版本 >= v1.6.7
2. 检查状态响应中是否包含 `resolution` 字段
3. 确认分辨率索引对应关系：-1=Default, 0=1366x768, 1=1920x1080, 2=2560x1440, 3=3840x2160

### NDI 控制无效

1. 确认 TinyCountdown 版本 >= v1.6.7
2. 确认系统已安装 NDI Runtime
3. 检查状态响应中是否包含 `ndi` 字段

### 重连失败

1. 检查 TinyCountdown 服务器是否正常运行
2. 确认用户名和密码是否正确
3. 查看 Companion 日志中是否有 `token/invalid` 或 WebSocket 关闭代码 1008 的错误
4. 模块会在 Token 失效时自动重新认证，重连间隔为指数退避（200ms/500ms/1000ms/2000ms/5000ms）
5. 若服务器重启，模块将在 200ms 内发起快速重连

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 格式化代码
npm run format

# 代码检查
npm run lint

# 打包模块
npx companion-module-build
```

### 项目结构

```
companion-module-tinycountdown/
├── companion/
│   ├── HELP.md          # 帮助文档
│   └── manifest.json    # 模块清单
├── src/
│   ├── main.js          # 主模块代码
│   ├── presets.js       # 预设按钮定义
│   └── upgrade.js       # 升级脚本
├── package.json         # 项目配置
├── .gitignore          # Git 忽略规则
└── README.md           # 说明文档
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 相关链接

- [Bitfocus Companion 官网](https://bitfocus.no/companion)
- [Companion 模块开发文档](https://companion.free/for-developers/module-development/module-development-101)
- [TinyCountdown 项目](../)
- [通用 WebSocket 模块参考](../companion-module-generic-websocket-master/)

## 致谢

- 基于 [companion-module-generic-websocket](https://github.com/bitfocus/companion-module-generic-websocket) 模块架构
- 感谢 Bitfocus Companion 团队提供的优秀框架

---

**作者**: Bob
**版本**: 1.6.7  
**最后更新**: 2026 年 6 月 26 日

---

**TinyCountDown v1.6.7 © 2026 Bob. All Rights Reserved.**
