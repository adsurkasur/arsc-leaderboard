'use client';

import Link from 'next/link';
import { m } from 'framer-motion';
import {
  ArrowDown,
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  Link2,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Header } from '@/components/layout/Header';
import { ParticipationModal } from '@/components/modals';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { accountUsesRapor } from '@/lib/sharedProfile';

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const flowSteps = [
  {
    icon: Link2,
    title: 'Hubungkan Rapor',
    description: 'Nama dan bidang/biro diambil dari identitas ARSC yang sudah terverifikasi.',
  },
  {
    icon: FileCheck2,
    title: 'Ajukan bukti kompetisi',
    description: 'Pilih kompetisi terdaftar atau usulkan lomba baru, lalu lampirkan bukti.',
  },
  {
    icon: ShieldCheck,
    title: 'Masuk setelah ditinjau',
    description: 'Poin mengikuti capaian yang sudah diverifikasi admin.',
  },
];

export default function HomePage() {
  const { user, isLoading, linkStatus, accountRole, refreshIdentityStatus } = useAuth();
  const isIdentityLinked = linkStatus === 'linked_exact' || linkStatus === 'manually_linked';
  const usesRapor = accountUsesRapor(accountRole);

  return (
    <m.div
      className="min-h-screen bg-background"
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
      transition={{ duration: 0.25 }}
    >
      <Header />

      <section className="relative overflow-hidden bg-[hsl(222_47%_8%)] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_15%_15%,hsl(217_91%_60%/0.22),transparent_30%),radial-gradient(circle_at_85%_80%,hsl(160_84%_45%/0.13),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(hsl(0_0%_100%/0.6)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%/0.6)_1px,transparent_1px)] [background-size:56px_56px]" />

        <div className="container relative grid gap-10 py-12 sm:py-16 md:py-20 lg:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)] lg:items-center lg:gap-16 lg:py-24">
          <m.div
            className="max-w-3xl"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            <m.p variants={reveal} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mb-5 text-sm font-semibold tracking-wide text-blue-300">
              Kompetisi & prestasi anggota ARSC
            </m.p>
            <m.h1
              variants={reveal}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.04em] sm:text-5xl md:text-6xl lg:text-[4.4rem]"
            >
              Prestasi ARSC,
              <span className="block text-blue-300">tercatat dengan jelas.</span>
            </m.h1>
            <m.p
              variants={reveal}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8"
            >
              Satu tempat untuk melihat partisipasi kompetisi yang sudah diverifikasi, mengajukan bukti, dan mengikuti perkembangan kontribusi anggota.
            </m.p>

            <m.div
              variants={reveal}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              {user && !isLoading && usesRapor ? (
                <ParticipationModal
                  user={user}
                  linkStatus={linkStatus}
                  onIdentityLinked={refreshIdentityStatus}
                />
              ) : !user ? (
                <Button asChild size="lg" className="h-12 rounded-full bg-white px-6 text-slate-950 hover:bg-blue-50">
                  <Link href="/auth">Masuk untuk mengajukan</Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost" size="lg" className="h-12 rounded-full px-5 text-slate-200 hover:bg-white/10 hover:text-white">
                <Link href="/leaderboard" className="gap-2">
                  Lihat peringkat
                  <ArrowDown className="size-4" />
                </Link>
              </Button>
            </m.div>

            {user && !isLoading && (
              <m.div
                variants={reveal}
                transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                className="mt-7 inline-flex items-center gap-2 text-sm text-slate-300"
              >
                {!usesRapor ? (
                  <>
                    <BadgeCheck className="size-4 text-emerald-300" />
                    Profil Halo PSDM aktif. Akun PH tidak memerlukan kode Rapor.
                  </>
                ) : isIdentityLinked ? (
                  <>
                    <BadgeCheck className="size-4 text-emerald-300" />
                    Identitas Anda sudah terhubung dengan Rapor.
                  </>
                ) : (
                  <>
                    <Link2 className="size-4 text-blue-300" />
                    Kode akses Rapor diperlukan satu kali saat pengajuan pertama.
                  </>
                )}
              </m.div>
            )}
          </m.div>

          <m.aside
            variants={reveal}
            transition={{ duration: 0.58, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="hidden rounded-[1.75rem] border border-white/10 bg-white/[0.065] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-7 lg:block"
            aria-label="Cara kerja Leaderboard"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-sm font-semibold text-white">Dari bukti ke peringkat</p>
                <p className="mt-1 text-sm text-slate-400">Alur yang dipakai Leaderboard</p>
              </div>
              <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-400/15 text-blue-300">
                <Trophy className="size-5" />
              </div>
            </div>

            <ol className="mt-6 space-y-6">
              {flowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-3">
                    <div className="relative flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-blue-300">
                      <Icon className="size-4" />
                      <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-blue-400 text-[10px] font-bold text-slate-950">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{step.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-emerald-300/[0.08] p-3.5 text-sm leading-6 text-emerald-100">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
              Data identitas berasal dari Rapor; bukti kompetisi tetap melalui peninjauan admin.
            </div>
          </m.aside>
        </div>
      </section>

      <section className="container py-8 md:hidden">
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-primary">Peringkat anggota</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Lihat kontribusi yang sudah diverifikasi</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Peringkat dibuka di halaman tersendiri agar lebih nyaman dicari dan dibaca dari ponsel.</p>
          <Button asChild className="mt-5 w-full rounded-xl"><Link href="/leaderboard">Buka leaderboard</Link></Button>
        </div>
      </section>

      <main id="leaderboard" className="hidden scroll-mt-24 md:block">
        <section className="container py-14 md:py-20">
          <m.div
            className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-9"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary">Peringkat anggota</p>
              <h2 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Kontribusi kompetisi yang sudah diverifikasi
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                Cari nama atau pilih kategori. Urutan didasarkan pada total poin dari capaian yang telah disetujui.
              </p>
            </div>
          </m.div>

          <LeaderboardTable />
        </section>
      </main>
    </m.div>
  );
}
