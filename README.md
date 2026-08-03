# 拾光

> 面向全厂网络与信息化工作的个人工作台
> React 19 · TypeScript · Vite · Tailwind CSS v4 · Electron

## 当前能力

- 今日工作台：集中显示今日已完成、待办、注意事项和三端同步状态
- 收件箱：把零散输入整理为可执行事项
- 工作事项：统一管理任务、服务请求、故障、变更和巡检
- 信息化项目：项目与工作事项关联，完成度只来自真实记录
- 设备资产：登记网络设备、服务器、终端和系统台账
- 文件盘：按收到、分类、正在干、干完、归档五层展示任务及其对应文件
- 工作统计：仅统计当前工作台真实数据，不展示演示指标
- 五层工作流：收到工作、分类工作、正在干的、干完的、归档的
- AI 状态整理：只接受后端受限接口返回的候选分类，不把建议伪装成已完成
- 设置：外观、COS 中枢状态和 NodeGateway 同步

## 数据原则

- COS 是业务文件与状态的唯一持久化真源
- 应用状态为 `paw.shiguang.state.v2`；旧 v1 仅在首次远端接管时迁移
- 拾光不直连 COS，不持有 COS 或 CAM 凭据
- Electron 只保留界面偏好；业务状态不写浏览器持久化，也不创建额外业务缓存
- NodeGateway 是唯一允许的业务缓存与同步出口；后台定时拉取只在本地无未提交变更时更新
- 多远端 head 或删除提案状态会阻断提交，不做自动覆盖
- 五个文件组共用逻辑文件 ID；跨组只修改清单并记录事件，不复制 COS Blob
- 本地固定入口为 `D:\拾光工作盘`（D 盘卷标“文件盘”）
- 每个文件必须绑定具体任务；项目代码只引用 Git 提交，普通工作文件由 NodeGateway 按需物化到任务目录
- 未接入的外部来源、附件上传、SLA 和 AI 指标不会伪装成可用

## 快速开始

```bash
npm install
npm run dev
npm run build
npm run test:gateway
```

## 目录结构

```text
src/
  components/
    layout/        # 侧栏与全局搜索
    modals/        # 新增事项弹窗
    ui/            # LiquidModal、LiquidSelect、页面过渡
  context/         # 工作台状态与 NodeGateway 同步状态
  lib/             # 状态合同、同步控制器、工作台语义和测试
  pages/           # 八个工作台页面
  index.css        # Liquid Glass 设计系统和响应式布局
electron/          # 主进程、预加载与六接口安全桥
```

## NodeGateway 安全接入

```text
React renderer → preload 固定 IPC → Electron main → 127.0.0.1 NodeGateway → PAW/COS
```

主进程继续使用既有六条 Shiguang 路由，renderer 只获得实时状态、拉取状态和提交状态三个高层能力。生产启动通过固定 DPAPI helper 读取令牌，并在全局 README 门禁通过后处理业务请求。C·ONE 只读取拾光的 DailyBrief 视图；现有功能与四个任务零修改，也没有扩展或绕过 NodeGateway 契约。

## 验证

```bash
npm run test:gateway
npm run build
```

## License

MIT
