# Gaia 随机地图素材与规则

本目录保存 4 人 Lost Fleet 扩展随机地图所需的板块图片。

生成器实现位于：

- `js/r2-boards.js`：R2 板块的局部行星坐标与种类。
- `js/gaia-map-generator.js`：地图布局、旋转、合规检测和 SVG 渲染。
- `js/map-share-assets.js`：分享图片专用的轻量内嵌地图素材，避免 SVG 图片在截图时丢失。
- `gaia.html`：配置选项与正式页面集成。
- `map-debugger/index.html`：独立地图 Debugger，可查看行星坐标、定位格子并检查随机布局。
- `scripts/compress-map-assets.py`：按页面实际显示尺寸和画质评分，将每张地图 PNG 自适应压缩至 20,000 字节以内。

当前规则：

- 仅在 4 人游戏且加入 Lost Fleet 扩展时提供地图生成选项，默认选择“否”。
- 从 01–04 中随机选择两个 R2 板块放入两个中心槽位，其余 R2 随机放置。
- R2 独立随机旋转 `0–5 × 60°`，生成结果不得存在同色行星相邻。
- 11–18 三角板随机位置、随机实心/空心，并独立随机旋转 `0–2 × 120°`。
- 4 个舰队特殊板块两两距离必须大于 3。

独立的地图 Debugger 已收录在仓库的 `map-debugger/` 目录，并复用正式页面的地图数据和图片素材。

随机分布与公平性压测结果见 [`RANDOMNESS-AUDIT.md`](RANDOMNESS-AUDIT.md)。可复现审计脚本位于 `scripts/audit-map-randomness.js`。

地图原图更新后：

1. 安装 Pillow 后运行 `python3 scripts/compress-map-assets.py`，将每张地图图片自适应压缩到 20,000 字节以内。
2. 运行 `node scripts/build-map-share-assets.js`，同步生成分享图片使用的内嵌素材。
