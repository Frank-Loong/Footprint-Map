# 更新日志

## [1.2.2] - 2025-06-29

### 修复
- 修正模板字符串开头换行导致 jQuery 无法正确解析 HTML，出现 `Syntax error, unrecognized expression` 的问题。

### 改进
- 更新 `FOOTPRINT_MAP_VERSION` 常量及所有相关引用，统一脚本/样式版本号，避免缓存。
- 插件文件头、后台关于页面版本信息同步至 1.2.2。

---

## [1.2.1] - 2025-06-22

### 新增
- **系统版本要求检查功能**
  - 添加 WordPress 5.0+ 版本检查
  - 添加 PHP 7.4+ 版本检查
  - 检查必要的 PHP 扩展：JSON、mbstring、cURL
  - 插件激活时自动检查系统要求，不满足要求时阻止激活
  - 在管理页面显示版本要求警告信息
  - 详细的错误提示，帮助用户了解具体问题

### 优化
- **README 文档更新**
  - 明确标注系统要求：WordPress 5.0+、PHP 7.4+
  - 添加浏览器兼容性说明
  - 完善网络访问要求说明
  - 更新安装步骤，添加 WordPress 后台上传安装方法

### 技术改进
- 使用 `version_compare()` 函数进行版本比较
- 使用 `function_exists()` 检查 PHP 扩展可用性
- 集成 WordPress 标准的错误处理机制
- 提供友好的用户界面反馈

## [1.2.0] - 2024-06-22

### 🎉 重大界面升级
- **全新的侧边菜单导航系统**
  - 重新设计后台界面布局，采用现代化的侧边菜单导航
  - 将功能模块分为 7 个独立板块：基础设置、备份设置、城市管理、城市列表、导入导出、使用说明、关于作者
  - 每个板块都有独立的页面和清晰的导航标识
  - 支持 URL 哈希导航，可直接访问特定功能页面

### 新增功能
- **基础设置板块**
  - 集中管理高德地图 API 配置
  - 清晰的设置说明和参数说明
- **备份设置板块**
  - 独立的 WebDAV 备份管理界面
  - 一键备份和恢复功能
- **城市管理板块**
  - 专门的城市添加和编辑界面
  - 完整的表单验证和预览功能
- **城市列表板块**
  - 增强的城市列表管理界面
  - 实时搜索功能（支持城市名称、编码、标签搜索）
  - 智能筛选功能（全部、最近添加、有标签）
  - 点击编辑自动跳转到城市管理页面
- **导入导出板块**
  - 独立的 JSON 数据导入导出界面
  - 文件上传和手动输入两种方式
  - 完整的数据格式说明和示例
- **使用说明板块**
  - 重新整理的使用指南
  - 分类清晰的功能介绍
  - 快速开始和进阶使用说明
- **关于作者板块**
  - 开发者信息展示
  - 插件版本和兼容性信息
  - 联系方式和支持渠道

### 界面优化
- **现代化设计语言**
  - 采用卡片式布局设计
  - 统一的颜色系统和间距规范
  - 优雅的悬停和过渡动画效果
- **响应式设计**
  - 桌面端侧边菜单布局
  - 平板端顶部菜单布局
  - 移动端优化的触摸体验
- **用户体验提升**
  - 清晰的视觉层次和信息架构
  - 直观的图标和文字标识
  - 流畅的页面切换和状态反馈

### 技术改进
- **模块化架构**
  - 功能模块独立，便于维护和扩展
  - 统一的 JavaScript 事件处理机制
  - 优化的 CSS 样式组织结构
- **性能优化**
  - 按需加载内容面板
  - 智能的数据缓存和更新机制
  - 减少不必要的 DOM 操作

## [1.1.5] - 2025-06-22

### 优化
- **WordPress 设置页面现代化升级**
  - 设置页面容器优化，使用最大宽度 1400px 居中布局
  - 页面标题现代化设计，添加渐变装饰条和地图图标
  - 设置表单卡片化设计，增加圆角、阴影和悬停效果
  - 表单字段现代化，统一输入框样式和焦点状态
  - 描述文字重新设计，使用彩色背景和左边框装饰
  - 设置分组标题优化，添加下划线装饰
  - 提交按钮现代化，增加悬停动画和阴影效果
  - 成功 / 错误 / 警告消息重新设计，使用彩色背景区分状态
  - 设置字段标签增强，添加左侧彩色装饰条
  - 页面加载动画优化，添加淡入上移动画效果
  - 响应式设计优化，移动端表单字段垂直排列
  - 滚动行为优化，支持平滑滚动
  - 打印样式优化，隐藏不必要的元素

### 技术改进
- 使用 CSS 变量系统统一设置页面样式
- 优化表单交互体验，增加焦点状态反馈
- 改进视觉层次，让重要信息更突出
- 增强无障碍性，提升键盘导航体验
- 保持与主界面设计风格的一致性

## [1.1.4] - 2025-06-22

### 优化
- **后台布局紧凑化优化**
  - 减少整体页面间距，从 32px 调整为 24px，提升空间利用率
  - 缩小侧边栏宽度，从 400px 调整为 350px，为主内容区域提供更多空间
  - 城市列表容器高度从 500px 减少到 400px，减少空白区域
  - 优化卡片内边距，从 32px 减少到 24px，让内容更紧凑
  - 调整表单元素间距，减少不必要的空白
  - 缩小字体大小和按钮尺寸，提升信息密度
  - 优化城市项目布局，减少内边距和间距
  - 调整分页控件和搜索框尺寸，保持功能性的同时减少占用空间
  - 优化响应式设计，在移动端保持紧凑布局

### 技术改进
- 统一间距系统，使用更小的基础单位
- 优化网格布局比例，提升空间利用率
- 减少视觉噪音，让重要信息更突出
- 保持现代化设计的同时提升实用性

## [1.1.3] - 2025-06-22

### 优化
- **后台 UI 全面现代化升级**
  - 采用现代化设计语言，使用 CSS 变量统一颜色和样式
  - 卡片设计升级，添加渐变顶部装饰条和悬停效果
  - 表单控件现代化，增加焦点状态和过渡动画
  - 按钮样式升级，添加光泽效果和悬停动画
  - 透明度滑块重新设计，支持自定义样式
  - 城市列表界面优化，增加卡片式布局和悬停效果
  - 搜索和筛选控件现代化，提升用户体验
  - 分页控件重新设计，增加视觉反馈
  - 导入导出功能界面优化，标签页设计更美观
  - 文件上传状态提示现代化，使用彩色背景区分状态
  - 描述预览模态框升级，添加淡入动画效果
  - 帮助内容重新设计，使用网格布局和图标装饰
  - Toast 消息提示现代化，添加滑入动画和彩色边框
  - 响应式设计优化，移动端体验大幅提升

### 技术改进
- 使用 CSS 变量系统，便于主题定制和维护
- 统一动画过渡效果，提升界面流畅度
- 优化阴影系统，增加层次感
- 改进颜色方案，使用现代化的灰度色阶
- 增强无障碍性，提升键盘导航体验

## [1.1.2] - 2025-06-22

### 新增
- **图片自适应排列功能**
  - 根据图片数量智能排列：2 张左右排列，4 张四宫格，9 张九宫格等
  - 移除滚动翻页，改为网格布局显示所有图片
  - 图片统一为正方形显示，提升视觉效果
  - 支持 1-12 张图片的不同排列方式

- **图片点击查看功能**
  - 点击图片可全屏查看
  - 支持键盘导航（左右箭头切换，ESC 关闭）
  - 显示图片计数器和导航按钮
  - 支持多张图片的连续浏览

### 优化
- 图片网格布局优化，根据图片数量自动调整列数和行数
- 图片悬停效果增强，添加阴影和缩放动画
- 信息窗口边界检测优化，确保始终在可视范围内
- 响应式设计改进，在不同屏幕尺寸下保持良好显示效果

### 修复
- **移除动态卡片大小调整功能**
  - 恢复信息窗口固定大小为 300x350px
  - 移除地图缩放时的动态大小调整
  - 修复信息窗口箭头位置偏移问题
  - 确保信息窗口始终指向正确的标记位置
- **修复图片点击查看功能**
  - 在信息窗口打开后重新绑定图片点击事件
  - 确保图片点击事件在动态生成的内容中正常工作
  - 修复图片模态框显示问题
  - **修复图片垂直居中显示问题**
    - 使用绝对定位和 transform 实现图片完全居中
    - 确保图片在模态框中水平和垂直都居中显示
  - **修复图片点击索引问题**
    - 使用 jQuery 的 index() 方法获取点击图片的实际索引
    - 确保点击哪张图片就显示哪张图片，而不是总是显示第一张
    - 统一中国地图和世界地图的图片点击事件处理逻辑
- 修复图片显示时可能超出卡片边界的问题
- 优化图片加载性能，减少内存占用
- 改进信息窗口定位逻辑，避免箭头位置偏移

## [1.1.1] - 2025-06-22

### 新增
- **多张图片支持**
  - 支持在图片URL字段中输入多张图片，用逗号分隔
  - 多张图片采用响应式网格布局显示
  - 图片自动适应卡片大小，防止图片过大影响显示效果
  - 支持悬停放大效果，提升浏览体验
  - 根据图片数量智能调整网格布局（1-2张：2列，3-4张：2列，5张以上：自适应）

### 优化
- 图片显示优化，单张图片最大高度限制为200px
- 多张图片容器最大高度限制为300px，超出时可滚动查看
- 响应式设计优化，在不同屏幕尺寸下图片布局自动调整
- 地图缩放时图片布局动态调整，确保最佳显示效果

### 修复
- 修复图片显示时可能超出卡片边界的问题
- 优化图片加载性能，使用lazy loading和object-fit优化显示效果
- **修复信息窗口自适应缩放问题**
  - 信息窗口大小固定为300x350px，不再随地图缩放变化
  - 修复地图缩放和移动时箭头位置偏移的问题
  - 移除动态字体大小调整，使用固定的字体大小
  - 确保信息窗口箭头始终指向正确的标记位置
  - 移除不必要的缩放和移动事件监听器，提升性能
- **优化Canvas警告和错误处理**
  - 静默处理Canvas相关的willReadFrequently警告
  - 优化地图清理逻辑，防止重复清理导致的错误
  - 添加Canvas优化设置，减少性能警告
  - 过滤document.write和非passive事件监听器警告
  - 改进地图切换时的防抖机制，增加延迟时间确保清理完成
  - 添加地图加载和清理状态检查，防止重复操作
- **修复CSS警告**
  - 为高德地图特有的CSS属性（stroke-color、fill-color）添加注释说明
  - 在CSS文件开头添加说明文档，解释这些属性的用途
  - 消除CSS验证器的未知属性警告

## [1.1.0] - 2025-06-22

### 新增
- **城市自动搜索功能**
  - 在添加城市时，输入城市名称可自动搜索匹配的城市
  - 支持从JSON数据文件中智能匹配城市信息
  - 自动填充城市编码和坐标到表单中
  - 支持键盘导航（上下箭头选择，回车确认，ESC关闭）
  - 搜索结果包含城市名称、级别和编码信息

### 技术实现
- 新增 `ajax_search_city` AJAX处理函数
- 新增 `search_cities_in_json` 和 `search_in_districts` 搜索方法
- 新增 `search_in_flat_structure` 方法支持港澳台和海外地区
- 支持搜索多个JSON数据文件（中国大陆、港澳台、海外）
- 递归搜索省、市、区县等不同级别的行政区划
- 支持中英文双语搜索
- 限制搜索结果数量，避免过多数据影响性能

### 界面优化
- 添加搜索结果下拉框样式
- 支持鼠标悬停和键盘选择高亮
- 优化搜索结果的视觉层次
- 添加城市搜索功能的使用提示
- **新增港澳台和海外地区地图显示**
  - 港澳台地区显示橙色圆形标记
  - 海外地区显示蓝色圆形标记
  - 添加地区类型标签
  - 支持悬停和点击交互效果

### 文档更新
- 更新README文档，添加新功能说明
- 添加详细的使用方法和数据来源说明
- 完善功能特性列表

### 修复
- **修复海外地区坐标格式验证问题**
  - 支持负数坐标（海外地区经度可能为负数）
  - 更新坐标验证正则表达式：`/^-?\d+\.\d+,-?\d+\.\d+$/`
  - 解决"坐标格式不正确"的错误提示

## [1.0.5] - 2025-06-21

### 新增
- 支持WebDAV自定义备份目录设置
- WebDAV备份文件自动覆盖功能，避免备份文件过多
- 自动创建WebDAV备份目录（如果不存在）

### 优化
- 改进WebDAV备份和恢复逻辑，使用固定文件名实现自动覆盖
- 优化WebDAV目录创建机制，支持嵌套目录结构

### 修复
- 修复WebDAV恢复功能，现在可以正确从自定义目录恢复数据

## [1.0.1] - 2025-06-21

### 新增
- 城市名称自动搜索匹配功能，支持从中国大陆、港澳台、海外地区数据中搜索
- 城市搜索结果支持键盘导航和美观的下拉样式
- 描述内容支持Markdown格式，自动引入marked.js库进行解析
- JSON导入导出功能，支持备份和恢复城市数据
- 右下角悬浮Toast消息提示，替换原有的消息弹窗
- 城市列表优化功能：搜索、筛选、分页，提升大量城市管理体验
- 全球地图支持，从中国地图升级为全球地图，显示全球国家和地区轮廓

### 优化
- 城市搜索支持中英文搜索和地区分类显示
- 海外地区坐标格式验证支持负数经度
- 城市数据合并逻辑以adcode+center为唯一标识避免重复
- 描述内容编辑和显示逻辑优化
- 城市列表支持按名称、编码、标签搜索
- 城市列表支持按最近添加、有标签等条件筛选
- 城市列表分页显示，每页10个城市，提升性能
- 城市列表显示添加时间，便于管理
- 地图视图从中国地图升级为全球地图，支持显示全球国家和地区
- 地图区域高亮逻辑优化，根据城市数量动态调整透明度
- 地图缩放级别调整为2-18级，支持全球到街道级别的查看
- 描述内容输入框优化，明确提示支持HTML和Markdown格式
- 添加描述内容格式使用说明和示例
- 地图样式简化，移除道路等详细信息，只保留行政区划和国家边界
- 地图填充效果优化，确保标记后区域正确高亮显示

### 修复
- 修复城市描述内容无法正确显示的问题
- 修复海外地区坐标格式验证错误
- 修复城市编辑时描述输入框未正确填充的问题
- 修复描述框无法回车换行的问题（排除textarea的回车键事件）
- 修复JSON导出功能无法正常工作的问题
- 修复表单清空时描述框未清空的问题
- 修复JSON导出时的Blob解析错误，使用原生XMLHttpRequest处理文件下载
- 修复地图填充逻辑，参考高德地图官方示例优化匹配算法
- 添加地图填充调试信息，便于诊断填充问题

## [1.0.0] - 2025-6-21

### 🎉 初始版本
- 基础地图展示功能
- 城市管理（添加、编辑、删除）
- 坐标拾取器
- WebDAV备份功能
- 自定义样式和描述
- 响应式设计 