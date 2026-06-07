"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

const EN_SECTIONS = [
  {
    heading: "Ownership",
    body: "Tim Indo Serba Bisa is a personal software project created and maintained independently by Jessica.\n\nThe software was developed outside of employment duties, using personal equipment, personal accounts, and personal resources. The project is not owned by, affiliated with, sponsored by, or operated on behalf of any employer, company, or organization unless explicitly stated otherwise in writing.",
  },
  {
    heading: "Purpose",
    body: "This application is provided to assist authorized users with administrative, communication, and productivity-related tasks.\n\nThe project is made available for team use as a convenience tool and is not intended for commercial sale.",
  },
  {
    heading: "License to Use",
    body: "Authorized users may access and use the hosted application for its intended purpose.\n\nAccess to the application does not grant any ownership rights, intellectual property rights, or rights to the source code.",
  },
  {
    heading: "Intellectual Property",
    body: "All source code, designs, documentation, and related materials remain the property of Jessica unless otherwise agreed in writing.",
    listPrefix: "Users may not:",
    list: [
      "Copy the source code",
      "Modify the source code",
      "Redistribute the source code",
      "Reverse engineer the application",
      "Claim ownership of any part of the software",
    ],
    listSuffix: "without prior written permission.",
  },
  {
    heading: "No Official Company Affiliation",
    body: "This application is an independent personal project.\n\nUse of the application by coworkers, team members, or other authorized users does not make the application an official company system.",
  },
  {
    heading: "No Warranty & Limitation of Liability",
    body: "The application is provided \"as is\" without warranty of any kind, express or implied. Jessica makes no guarantees regarding uptime, accuracy, or fitness for a particular purpose.\n\nTo the fullest extent permitted by applicable law, Jessica shall not be liable for any loss of data, service interruption, or damages arising from the use of this application.",
  },
  {
    heading: "Availability",
    body: "The application is provided on a best-effort basis. Features may be modified, suspended, or discontinued at any time without notice.",
  },
  {
    heading: "Privacy",
    body: "Use of this application is also governed by the Privacy Policy, which is incorporated into these Terms of Use by reference.",
  },
  {
    heading: "Contact",
    body: "For questions regarding this project, please contact Jessica.",
  },
]

const JA_SECTIONS = [
  {
    heading: "所有権",
    body: "Tim Indo Serba Bisa は、Jessicaが独自に作成・管理する個人ソフトウェアプロジェクトです。\n\n本ソフトウェアは、業務上の義務とは無関係に、個人の機器・アカウント・リソースを使用して開発されました。本プロジェクトは、書面による明示的な合意がない限り、いかなる雇用主・企業・組織によっても所有・提携・後援・運営されるものではありません。",
  },
  {
    heading: "目的",
    body: "本アプリケーションは、認可されたユーザーが管理・コミュニケーション・生産性に関連するタスクを行えるよう提供されています。\n\n本プロジェクトはチームの利便性向上を目的として提供されており、商業販売を目的としたものではありません。",
  },
  {
    heading: "利用ライセンス",
    body: "認可されたユーザーは、所定の目的のためにホストされたアプリケーションにアクセスし、使用することができます。\n\nアプリケーションへのアクセスは、所有権、知的財産権、またはソースコードに対するいかなる権利も付与するものではありません。",
  },
  {
    heading: "知的財産",
    body: "書面による別段の合意がない限り、すべてのソースコード、デザイン、ドキュメント、および関連資料はJessicaの財産です。",
    listPrefix: "事前の書面による許可なく、ユーザーは以下を行うことができません：",
    list: [
      "ソースコードの複製",
      "ソースコードの改変",
      "ソースコードの再配布",
      "アプリケーションのリバースエンジニアリング",
      "ソフトウェアの一部に対する所有権の主張",
    ],
    listSuffix: "",
  },
  {
    heading: "会社との無関係",
    body: "本アプリケーションは独立した個人プロジェクトです。\n\n同僚、チームメンバー、またはその他の認可されたユーザーによるアプリケーションの使用は、本アプリケーションを会社の公式システムとするものではありません。",
  },
  {
    heading: "無保証・責任制限",
    body: "本アプリケーションは、明示または黙示を問わず、いかなる種類の保証もなく「現状のまま」提供されます。Jessicaは、稼働時間、正確性、または特定目的への適合性についていかなる保証も行いません。\n\n適用法令の許容する最大限の範囲において、Jessicaは本アプリケーションの使用に起因するデータの損失、サービスの中断、または損害について一切責任を負いません。",
  },
  {
    heading: "可用性",
    body: "本アプリケーションはベストエフォート方式で提供されます。機能は予告なくいつでも変更、停止、または中止される場合があります。",
  },
  {
    heading: "プライバシー",
    body: "本アプリケーションの使用は、これらの利用規約に参照として組み込まれるプライバシーポリシーにも準拠します。",
  },
  {
    heading: "お問い合わせ",
    body: "本プロジェクトに関するご質問は、Jessicaまでお問い合わせください。",
  },
]

type Section = typeof EN_SECTIONS[number]

function Section({ s }: { s: Section }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[0.78rem] font-semibold uppercase tracking-wider text-[var(--text-2)]">{s.heading}</h2>
      {s.body.split("\n\n").map((p, i) => (
        <p key={i} className="text-sm text-[var(--text-2)] leading-relaxed">{p}</p>
      ))}
      {s.list && (
        <>
          {s.listPrefix && <p className="text-sm text-[var(--text-2)] leading-relaxed">{s.listPrefix}</p>}
          <ul className="list-disc list-inside flex flex-col gap-1 pl-1">
            {s.list.map((item, i) => (
              <li key={i} className="text-sm text-[var(--text-2)]">{item}</li>
            ))}
          </ul>
          {s.listSuffix && <p className="text-sm text-[var(--text-2)] leading-relaxed">{s.listSuffix}</p>}
        </>
      )}
    </div>
  )
}

function TermsContent() {
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
          <Link href="/terms" className={`text-[0.65rem] px-2 py-0.5 rounded border transition-colors ${lang === "en" ? "border-[var(--text)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"}`}>EN</Link>
          <Link href="/terms?lang=ja" className={`text-[0.65rem] px-2 py-0.5 rounded border transition-colors ${lang === "ja" ? "border-[var(--text)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"}`}>JA</Link>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <div className="border-b border-[var(--border)] pb-6">
          <p className="label-xs mb-2">{lang === "ja" ? "利用規約" : "Terms of Use"}</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Tim Indo Serba Bisa</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">{lang === "ja" ? "最終更新：2026年6月" : "Last updated: June 2026"}</p>
          <Link href={lang === "ja" ? "/privacy?lang=ja" : "/privacy"}
            className="text-[0.7rem] text-[var(--text-3)] underline underline-offset-2 hover:text-[var(--text)] transition-colors mt-2 inline-block">
            {lang === "ja" ? "→ プライバシーポリシー" : "→ Privacy Policy"}
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

export default function TermsPage() {
  return (
    <Suspense>
      <TermsContent />
    </Suspense>
  )
}
