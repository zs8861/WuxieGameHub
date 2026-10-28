# WuxieGameHub
存放了秦无邪OvO所有自制游戏的Bilibili-TOY网页端（点击即玩）
本站点部署在两个地方：
https://www.aibitgames.com/
和
https://www.bilibili.com/toy/WuxieGameHub/index.html

## 发布脚本
- 仅更新 `index.html` 里的资源版本号（自动使用当前 `git` 短哈希）：
  - `pwsh -File .\scripts\publish-toy.ps1`
- 更新版本号并直接发布到 TOY（`toy.yaml` 有 `id` 时可省略参数）：
  - `pwsh -File .\scripts\publish-toy.ps1 -Publish`
  - 或指定：`pwsh -File .\scripts\publish-toy.ps1 -Publish -ToyId 9790201842688`
