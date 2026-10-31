# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## プロジェクト概要

バイト先のシフト管理アプリ（課題用）。**仕様の正本は `docs/requirements.md`**。実装前に必ず読み、機能ID（F-01〜F-22）・ページ一覧・人数の数え方は要件定義書に合わせる。未決事項は付録B、作業の順番は付録E。

## コマンド

```bash
npm run dev     # 開発サーバー（http://localhost:3000）
npm run build   # 本番ビルド（型チェックもここで走る）
npm run lint    # ESLint（flat config: eslint.config.mjs）
```

テストフレームワークはまだ入っていない。

## 技術構成

- Next.js 16（App Router, `src/app/`）＋ React 19 ＋ TypeScript（strict）＋ Tailwind CSS v4
  - Next.js は学習データより新しい版。API を書く前に `node_modules/next/dist/docs/` の該当ガイドを読む（AGENTS.md 参照）
  - `next.config.ts` で `cacheComponents: true` と `partialPrefetching: true` が有効。データ取得・キャッシュの書き方はこの前提でドキュメントを確認する
  - Tailwind は `@tailwindcss/turbopack` ローダー経由（`next.config.ts` の `turbopack.rules`）。`globals.css` で `@import "tailwindcss"`、テーマは `@theme inline`
- パスエイリアス：`@/*` → `src/*`

## 全体アーキテクチャ（要件定義書 §1・§5 より）

```
ブラウザ（スマホ／PC） → Next.js Route Handler（/api/...） → Apps Script ウェブアプリ → Googleスプレッドシート
```

- **データはすべて Google スプレッドシート**。DB は持たない。作成者はスプシ上でシフトを組む（L/F/早/遅 を手入力）
- **Apps Script の窓口 URL はサーバー側（Route Handler）からだけ呼ぶ**。URL は `APPS_SCRIPT_URL`（`.env.local`／Vercel 環境変数）。詳しくは下の「プロジェクト固有ルール」
- スプシ側の自動処理（色付け・人数計算・祝日判定・翌月シート作成）は Apps Script＋数式・条件付き書式の担当で、Next.js 側では再実装しない。ただし /admin の「足りない日」一覧（F-11）は人数ルールに依存する
- スプシ構成：`名簿`（名前・区分）／`ひな形`／月ごとのシート（例 `2026-11`、行＝人・列＝日付、「公開する」チェック付き）

### ページ（MVP）

| URL | 内容 | 想定端末 |
|---|---|---|
| `/` | 名前を選ぶ（F-01）。選んだ名前は端末に保存し、次回は `/me` へ自動遷移 | スマホ |
| `/me` | 自分のシフト（F-04）。日付タップでその日のメンバーを下から出る小窓で表示（F-05、別ページにしない）。未公開月は「作成中」 | スマホ |
| `/me/availability` | 翌月の勤務可能日をカレンダーで選んで提出（F-02・F-03） | スマホ |
| `/admin` | 足りない日の一覧＋再募集LINE文面のコピー（F-11・F-12） | PC |

`/me` 系は画面下の2タブで行き来する。

## ドメインルール（実装で間違えやすい所）

- 必要人数：平日3人／土日祝4人。多すぎる＝平日4人以上／土日祝5人以上
- L（リーダー）・F（フルタイム）・社員＝1人、早・遅＝0.5人。早だけ／遅だけの日は「足りない」扱い
- 表示：L＝赤背景、F＝青背景、早・遅＝黒字（スプシ上の「前」「後」はアプリでは「早」「遅」）
- 勤務可能日の再提出は上書き。ただし作成者が入れた L/F/早/遅 は消さない
- 再募集文面（F-12）は要件定義書 付録D の形式に合わせる（「2日　2枠」、早/遅だけ欠けた日は「8日　遅番1枠」、ひとことは自由入力）

## プロジェクト固有ルール

- **返答・説明はすべて日本語**。ユーザーは初心者なので、専門用語には短い説明を付ける（例：「Route Handler（サーバー側で動く API の入口）」）
- **仕様は `docs/requirements.md` が正**。決まったことや進み具合は、このファイルの「実装の進み具合」表と「更新履歴」に随時書き足す
- **有料 API・有料サービスは使わない**（すべて無料。Vercel も無料プラン）
- **本名をコード・スプシ・スクショ・記事に入れない**。名前は `docs/requirements.md` の「ダミーの名簿」を使う
- **Apps Script の窓口 URL は `.env.local` の `APPS_SCRIPT_URL` に置き、`NEXT_PUBLIC_` は付けない**（付けるとブラウザに漏れる）。ブラウザからは `/api` 経由でだけ呼ぶ
- **バイト用画面はスマホ（横幅 375px）優先、ボタンは 44px 以上**。作成者用画面はパソコン優先
- **1ステップずつ進め、区切りごとに動作確認してからコミットする**
- MVP はログインなし（`/admin` も含む）。`/admin` には**名前を出さず**「足りない日と人数」だけを表示する
- 開発の進め方：Plan Mode で設計 → ユーザー確認 → 実装
