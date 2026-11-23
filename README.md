# Cheap-Cheer

记录我看过的电影和读过的书。页面由仓库里的 JSON 生成，发布在 [cheap-cheer.github.io](https://cheap-cheer.github.io/)。

## 本地预览

```bash
npm run preview
```

然后打开 http://127.0.0.1:4173 。`npm run validate` 只检查记录，`npm run build` 把站点生成到 `dist/`。

## 添加记录

电影写在 `movies.json`，书籍写在 `reading.json`，只记得名字和年份的旧记录写在 `archive.json`。三个文件开头的 `$schema` 会在编辑器里给出补全，缺字段或日期格式不对时会标红。

`movies.json` 里一条记录至少要有片名、观看日期、1 到 5 的评分和短评。日期可以是 `2026-11-23`、`2026-11` 或 `2026`。知道豆瓣编号时填 `doubanId`，上映年份填 `releaseYear`。

`reading.json` 同样记下阅读日期和短评，作者、出版年份可以一并写上。

`archive.json` 只收片名和年份。同一部作品如果已经出现在今年的记录里，页面上只显示一次，按片名和年份区分。

年份不能早于 1900，也不能晚于明年。校验不通过时，GitHub Actions 不会发布。

线上页面的「在 GitHub 添加记录」默认不显示。自己的浏览器打开一次 `?edit=1` 之后会记住，`?edit=0` 可以关掉。本机预览时一直显示。

## 海报

海报存在 `public/posters/`，页面只读取这些同域图片。推送到 `main` 之后，Actions 会用 TMDB 给还没有海报的电影补一张图，转成 WebP，再写回仓库。

匹配失败时，Actions 的运行摘要里会列出片名。给那条记录补上 `tmdbId` 再推送一次即可。已经匹配过的电影不会重复请求。

## 部署

推送到 `main` 会先校验记录，再补海报、生成页面并发布。Actions 自己提交海报时不会再触发一次发布。

## 许可

代码使用 MIT 许可证。短评、评分和个人介绍保留权利。海报版权归原权利人，详见 [LICENSE](LICENSE)。
