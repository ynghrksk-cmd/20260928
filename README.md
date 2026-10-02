# LINEスタンプ・絵文字メーカー

画像をアップロードして、LINE スタンプ／LINE 絵文字の申請用画像を作成するブラウザアプリです。
画像はすべてブラウザ内で処理され、サーバーには送信されません。

## できること

1. **画像のアップロード**：複数枚をまとめて追加できます（別の AI で作ったポーズ違いの画像など）
   - ポーズ一覧の1枚画像は「分割」で切り分け可能（背景のすき間から自動検出／行×列で均等分割、余白の自動トリミング）
2. **セリフを選んで一括生成**：定番セリフのプリセットやオリジナルのセリフを選ぶと、画像と順番に組み合わせて 8〜40 枚を自動作成
3. **1枚ずつ仕上げ**
   - 画像：差し替え、拡大・回転・左右反転、ドラッグで移動
   - 背景の透過：クリックした色（または四隅から自動検出した色）を透明化。外側から続く部分だけを消すモードあり
   - 白フチ：太さ・色を指定
   - 文字：フォント 5 種、文字色・フチ色・太さ・傾き、ドラッグで移動、改行で 2 行
   - 複製・削除・並べ替え、設定を全てのスタンプに適用
4. **自動保存**：作業内容はブラウザ（IndexedDB）に自動保存され、ページを開き直しても続きから作業できます
5. **ZIP でダウンロード**：LINE Creators Market にそのままアップロードできる形式

| 種類 | 画像 | ファイル名 | 付属画像 |
| --- | --- | --- | --- |
| スタンプ | 最大 370×320px（余白 10px を残して自動トリミング、偶数サイズ） | `01.png`〜`40.png` | `main.png` 240×240、`tab.png` 96×74 |
| 絵文字 | 180×180px | `001.png`〜`040.png` | `tab.png` 96×74 |

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm test         # ユニットテスト（画素処理・セット生成）
npm run lint
npm run build    # dist/ に静的ファイルを出力
```

`dist/` は相対パスで出力されるため、GitHub Pages など任意の静的ホスティングに置けます。

## 構成

- `src/lib/specs.ts` … LINE の画像規格
- `src/lib/pixels.ts` … 背景透過・トリミングなどの画素処理（純粋関数）
- `src/lib/render.ts` … Canvas での描画（画像・白フチ・文字）
- `src/lib/exportZip.ts` … ZIP 書き出し
- `src/lib/presets.ts` … セリフのプリセット、一括生成
- `src/lib/split.ts` … 一覧画像のコマ分割
- `src/lib/storage.ts` … 作業内容の自動保存（IndexedDB）
- `src/components/` … 画面

## 公開（GitHub Pages）

`.github/workflows/deploy.yml` により、`main`（または開発ブランチ）へ push すると自動でビルド・テストしてデプロイします。
初回のみ以下の設定が必要です。

1. リポジトリの **Settings → General → Danger Zone → Change visibility** で Public にする
2. **Settings → Pages → Build and deployment → Source** を「GitHub Actions」にする
3. **Actions** タブで「Deploy to GitHub Pages」を再実行（Run workflow）

公開 URL: `https://<ユーザー名>.github.io/<リポジトリ名>/`
