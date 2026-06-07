"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

const EN_SECTIONS = [
  {
    heading: "Overview",
    body: "Tim Indo Serba Bisa is an independent personal project provided for authorized team use.\n\nThis application stores and processes information necessary to provide its features and enable collaboration between users.",
  },
  {
    heading: "Information We Collect",
    body: "Depending on the features used, the application may store:",
    list: [
      "Account information",
      "User-generated content",
      "Uploaded files and documents",
      "Team-related data",
      "Application usage information",
      "Technical and diagnostic information",
    ],
  },
  {
    heading: "Artificial Intelligence",
    body: "This application was developed with the assistance of AI tools. AI may be used to support certain features or functionality within the application.",
  },
  {
    heading: "Cookies & Local Storage",
    body: "The application may use cookies or local storage to support functionality and analytics. This includes maintaining session state and understanding how features are used.",
  },
  {
    heading: "Analytics",
    body: "The application may collect usage and performance data to help improve reliability, identify issues, and understand how features are used. This data is collected anonymously where possible and is not used for advertising purposes.",
  },
  {
    heading: "Data Storage",
    body: "Information submitted through the application may be stored on third-party infrastructure providers used to operate the service.\n\nData is stored only for the purpose of providing application functionality, synchronization, backups, maintenance, and security.",
  },
  {
    heading: "Data Retention",
    body: "Data is retained for as long as necessary to provide the service, unless deletion is requested or otherwise required. Some information may be retained for technical, operational, backup, security, or legal purposes.",
  },
  {
    heading: "Data Sharing",
    body: "Data is not sold to third parties.\n\nInformation may be processed by service providers that support the operation of the application, including hosting, storage, authentication, analytics, and related technical services.",
  },
  {
    heading: "Data Deletion",
    body: "Users may request deletion of their data where reasonably possible. Some information may be retained for technical, operational, backup, security, or legal purposes.",
  },
  {
    heading: "Security",
    body: "Reasonable measures are taken to protect stored information. However, no online service can guarantee absolute security.",
  },
  {
    heading: "Changes",
    body: "This Privacy Policy may be updated from time to time. Continued use of the application after changes are published constitutes acceptance of the updated policy.",
  },
  {
    heading: "Contact",
    body: "For privacy-related questions or requests, please contact Jessica.",
  },
]

const JA_SECTIONS = [
  {
    heading: "概要",
    body: "Tim Indo Serba Bisa は、認可されたチーム利用のために提供される独立した個人プロジェクトです。\n\n本アプリケーションは、機能の提供およびユーザー間の共同作業を可能にするために必要な情報を保存・処理します。",
  },
  {
    heading: "収集する情報",
    body: "使用する機能に応じて、本アプリケーションは以下の情報を保存する場合があります：",
    list: [
      "アカウント情報",
      "ユーザーが生成したコンテンツ",
      "アップロードされたファイルおよび文書",
      "チーム関連データ",
      "アプリケーション使用情報",
      "技術的および診断情報",
    ],
  },
  {
    heading: "人工知能（AI）",
    body: "本アプリケーションはAIツールの支援を受けて開発されました。また、AIが一部の機能をサポートするために使用される場合があります。",
  },
  {
    heading: "クッキーおよびローカルストレージ",
    body: "本アプリケーションは、機能および分析をサポートするためにクッキーやローカルストレージを使用する場合があります。これには、セッション状態の維持や機能の使用状況の把握が含まれます。",
  },
  {
    heading: "アナリティクス",
    body: "本アプリケーションは、信頼性の向上、問題の特定、および機能の使用状況を把握するために、使用状況および性能データを収集する場合があります。このデータは可能な限り匿名で収集され、広告目的には使用されません。",
  },
  {
    heading: "データの保存",
    body: "本アプリケーションを通じて送信された情報は、サービスの運営に使用される第三者インフラプロバイダーに保存される場合があります。\n\nデータは、アプリケーション機能の提供、同期、バックアップ、メンテナンス、およびセキュリティの目的のみに保存されます。",
  },
  {
    heading: "データの保持期間",
    body: "データは、サービスの提供に必要な期間保持されます。ただし、削除のリクエストがあった場合や、その他の理由がある場合はこの限りではありません。技術的、運用的、バックアップ、セキュリティ、または法的な理由から一部の情報が保持される場合があります。",
  },
  {
    heading: "データの共有",
    body: "データは第三者に販売されません。\n\n情報は、ホスティング、ストレージ、認証、アナリティクス、および関連技術サービスを含む、アプリケーションの運営をサポートするサービスプロバイダーによって処理される場合があります。",
  },
  {
    heading: "データの削除",
    body: "ユーザーは、合理的に可能な範囲でデータの削除をリクエストすることができます。技術的、運用的、バックアップ、セキュリティ、または法的な理由から一部の情報が保持される場合があります。",
  },
  {
    heading: "セキュリティ",
    body: "保存された情報を保護するために合理的な措置を講じています。ただし、いかなるオンラインサービスも絶対的なセキュリティを保証することはできません。",
  },
  {
    heading: "変更",
    body: "本プライバシーポリシーは随時更新される場合があります。変更が公開された後に本アプリケーションを継続して使用することは、更新されたポリシーへの同意とみなされます。",
  },
  {
    heading: "お問い合わせ",
    body: "プライバシーに関するご質問やリクエストは、Jessicaまでお問い合わせください。",
  },
]

type Section = typeof EN_SECTIONS[number]

function Section({ s }: { s: Section }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[0.78rem] font-semibold uppercase tracking-wider text-[var(--text-2)]">{s.heading}</h2>
      {s.body && s.body.split("\n\n").map((p, i) => (
        <p key={i} className="text-sm text-[var(--text-2)] leading-relaxed">{p}</p>
      ))}
      {s.list && (
        <ul className="list-disc list-inside flex flex-col gap-1 pl-1">
          {s.list.map((item, i) => (
            <li key={i} className="text-sm text-[var(--text-2)]">{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PrivacyContent() {
  const params = useSearchParams()
  const lang = params.get("lang") === "ja" ? "ja" : "en"
  const sections = lang === "ja" ? JA_SECTIONS : EN_SECTIONS

  return (
    <div className="min-h-screen px-5 py-12 max-w-2xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-[0.75rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
          ← Back
        </Link>
        <div className="flex gap-2">
          <Link href="/privacy" className={`text-[0.65rem] px-2 py-0.5 rounded border transition-colors ${lang === "en" ? "border-[var(--text)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"}`}>EN</Link>
          <Link href="/privacy?lang=ja" className={`text-[0.65rem] px-2 py-0.5 rounded border transition-colors ${lang === "ja" ? "border-[var(--text)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"}`}>JA</Link>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <div className="border-b border-[var(--border)] pb-6">
          <p className="label-xs mb-2">{lang === "ja" ? "プライバシーポリシー" : "Privacy Policy"}</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Tim Indo Serba Bisa</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">{lang === "ja" ? "最終更新：2026年6月" : "Last updated: June 2026"}</p>
          <Link href={lang === "ja" ? "/terms?lang=ja" : "/terms"}
            className="text-[0.7rem] text-[var(--text-3)] underline underline-offset-2 hover:text-[var(--text)] transition-colors mt-2 inline-block">
            {lang === "ja" ? "→ 利用規約" : "→ Terms of Use"}
          </Link>
        </div>

        <div className="flex flex-col gap-7">
          {sections.map((s, i) => <Section key={i} s={s} />)}
        </div>

        <p className="text-[0.7rem] text-[var(--text-3)] border-t border-[var(--border)] pt-4">
          © 2026 Jessica. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <Suspense>
      <PrivacyContent />
    </Suspense>
  )
}
