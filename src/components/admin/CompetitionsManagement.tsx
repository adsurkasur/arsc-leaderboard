'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CircleAlert,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
  Competition,
  CompetitionScoringRule,
  ScoringTemplate,
  ScoringTemplateRule,
} from '@/lib/types';
import { saveCompetition } from '@/lib/actions/stage5_competitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/async';

type SortField = 'title' | 'category' | 'date';
type SortDirection = 'asc' | 'desc';
type CompetitionWithRules = Competition & { scoring_rules: CompetitionScoringRule[] };

interface EditableRule {
  id?: string;
  label: string;
  points: number | '';
}

interface CompetitionForm {
  title: string;
  date: string;
  description: string;
  category: string;
  isActive: boolean;
  templateId: string | null;
  rules: EditableRule[];
}

const emptyForm = (): CompetitionForm => ({
  title: '',
  date: new Date().toISOString().slice(0, 10),
  description: '',
  category: 'Umum',
  isActive: true,
  templateId: null,
  rules: [{ label: 'Peserta', points: 0 }],
});

function normalizeRules(rules: CompetitionScoringRule[]) {
  return [...rules]
    .filter((rule) => rule.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export function CompetitionsManagement() {
  const [competitions, setCompetitions] = useState<CompetitionWithRules[]>([]);
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isStage5Ready, setIsStage5Ready] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<CompetitionWithRules | null>(null);
  const [formData, setFormData] = useState<CompetitionForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoadError(null);

    const [competitionResult, templateResult] = await Promise.all([
      supabase
        .from('competitions')
        .select('*, scoring_rules:leaderboard_competition_scoring_rules(*)')
        .order('date', { ascending: false }),
      supabase
        .from('leaderboard_scoring_templates')
        .select('*, rules:leaderboard_scoring_template_rules(*)')
        .order('name'),
    ]);

    if (!competitionResult.error && !templateResult.error) {
      const nextCompetitions = (competitionResult.data ?? []).map((competition) => ({
        ...competition,
        scoring_rules: normalizeRules(
          (competition.scoring_rules ?? []) as CompetitionScoringRule[],
        ),
      })) as CompetitionWithRules[];

      const nextTemplates = (templateResult.data ?? []).map((template) => ({
        ...template,
        rules: [...((template.rules ?? []) as ScoringTemplateRule[])].sort(
          (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
        ),
      })) as ScoringTemplate[];

      setCompetitions(nextCompetitions);
      setTemplates(nextTemplates);
      setIsStage5Ready(true);
      setIsLoading(false);
      return;
    }

    // Keep the page readable if frontend deployment lands before the manual SQL step.
    const fallback = await supabase
      .from('competitions')
      .select('id, title, date, description, category, created_at, updated_at')
      .order('date', { ascending: false });

    setCompetitions(
      (fallback.data ?? []).map((competition) => ({
        ...competition,
        is_active: true,
        scoring_template_id: null,
        scoring_rules: [],
      })) as CompetitionWithRules[],
    );
    setTemplates([]);
    setIsStage5Ready(false);
    setLoadError(
      fallback.error
        ? getErrorMessage(fallback.error, 'Data kompetisi belum dapat dimuat.')
        : 'Konfigurasi scoring Stage 5 belum tersedia di database.',
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const sortedAndFilteredCompetitions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = competitions.filter(
      (competition) =>
        competition.title.toLowerCase().includes(query)
        || competition.category.toLowerCase().includes(query),
    );

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'title') comparison = a.title.localeCompare(b.title);
      if (sortField === 'category') comparison = a.category.localeCompare(b.category);
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [competitions, searchQuery, sortDirection, sortField]);

  const applyTemplate = (templateId: string) => {
    if (templateId === 'custom') {
      setFormData((current) => ({
        ...current,
        templateId: null,
        rules: current.rules.length > 0 ? current.rules : [{ label: 'Peserta', points: 0 }],
      }));
      return;
    }

    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    setFormData((current) => ({
      ...current,
      templateId: template.id,
      category: template.suggested_category,
      rules: template.rules.map((rule) => ({ label: rule.label, points: rule.points })),
    }));
  };

  const openCreateDialog = () => {
    const recommendedTemplate = templates.find((template) => template.code === 'nasional') ?? templates[0];
    const nextForm = emptyForm();

    if (recommendedTemplate) {
      nextForm.templateId = recommendedTemplate.id;
      nextForm.category = recommendedTemplate.suggested_category;
      nextForm.rules = recommendedTemplate.rules.map((rule) => ({
        label: rule.label,
        points: rule.points,
      }));
    }

    setEditingCompetition(null);
    setFormData(nextForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (competition: CompetitionWithRules) => {
    setEditingCompetition(competition);
    setFormData({
      title: competition.title,
      date: competition.date,
      description: competition.description ?? '',
      category: competition.category,
      isActive: competition.is_active,
      templateId: competition.scoring_template_id,
      rules: competition.scoring_rules.map((rule) => ({
        id: rule.id,
        label: rule.label,
        points: rule.points,
      })),
    });
    setIsDialogOpen(true);
  };

  const updateRule = (index: number, patch: Partial<EditableRule>) => {
    setFormData((current) => ({
      ...current,
      rules: current.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule,
      ),
    }));
  };

  const removeRule = (index: number) => {
    setFormData((current) => ({
      ...current,
      rules: current.rules.filter((_, ruleIndex) => ruleIndex !== index),
    }));
  };

  const handleSave = async () => {
    const normalizedRules = formData.rules.map((rule, index) => ({
      id: rule.id,
      label: rule.label.trim(),
      points: Number(rule.points),
      sort_order: (index + 1) * 10,
    }));

    if (!formData.title.trim() || !formData.date || !formData.category.trim()) {
      toast({
        title: 'Data belum lengkap',
        description: 'Nama, tanggal, dan kategori kompetisi wajib diisi.',
        variant: 'destructive',
      });
      return;
    }
    if (
      normalizedRules.length === 0
      || normalizedRules.some(
        (rule) => !rule.label || !Number.isInteger(rule.points) || rule.points < 0,
      )
    ) {
      toast({
        title: 'Aturan skor belum valid',
        description: 'Tambahkan minimal satu capaian dengan poin bilangan bulat minimal 0.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveCompetition({
        id: editingCompetition?.id,
        title: formData.title.trim(),
        date: formData.date,
        description: formData.description.trim() || null,
        category: formData.category.trim(),
        isActive: formData.isActive,
        templateId: formData.templateId,
        rules: normalizedRules,
      });

      if (!result.success) throw new Error(result.error);

      toast({
        title: 'Kompetisi tersimpan',
        description: `${normalizedRules.length} aturan poin siap digunakan.`,
      });
      setIsDialogOpen(false);
      await fetchData();
    } catch (error) {
      toast({
        title: 'Kompetisi belum tersimpan',
        description: getErrorMessage(error, 'Terjadi kesalahan saat menyimpan kompetisi.'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (competition: CompetitionWithRules) => {
    if (competition.is_active) {
      const approved = window.confirm(
        `Arsipkan "${competition.title}"? Kompetisi tidak akan muncul di formulir baru, tetapi seluruh riwayat tetap aman.`,
      );
      if (!approved) return;
    }

    const result = await saveCompetition({
      id: competition.id,
      title: competition.title,
      date: competition.date,
      description: competition.description,
      category: competition.category,
      isActive: !competition.is_active,
      templateId: competition.scoring_template_id,
      rules: competition.scoring_rules.map((rule, index) => ({
        id: rule.id,
        label: rule.label,
        points: rule.points,
        sort_order: (index + 1) * 10,
      })),
    });

    if (!result.success) {
      toast({ title: 'Status belum berubah', description: result.error, variant: 'destructive' });
      return;
    }

    toast({
      title: competition.is_active ? 'Kompetisi diarsipkan' : 'Kompetisi diaktifkan',
      description: competition.is_active
        ? 'Riwayat tetap tersimpan dan pengajuan baru ditutup.'
        : 'Kompetisi kembali tersedia untuk pengajuan.',
    });
    await fetchData();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDirection(field === 'title' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 size-4 opacity-50" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 size-4" />
      : <ArrowDown className="ml-1 size-4" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-44" />
        </div>
        {[...Array(3)].map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!isStage5Ready && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/5 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Konfigurasi scoring belum aktif</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {loadError} Jalankan artifact Stage 5 di Supabase sebelum membuat kompetisi.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau kategori kompetisi"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2" disabled={!isStage5Ready}>
              <Plus className="size-4" />
              Tambah Kompetisi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingCompetition ? 'Edit kompetisi' : 'Buat kompetisi'}</DialogTitle>
              <DialogDescription>
                Pilih preset untuk mulai cepat, lalu ubah nama capaian dan poin sesuai kebutuhan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="competition-title">Nama kompetisi</Label>
                  <Input
                    id="competition-title"
                    value={formData.title}
                    onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                    placeholder="Contoh: Gemastik 2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-date">Tanggal</Label>
                  <Input
                    id="competition-date"
                    type="date"
                    value={formData.date}
                    onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-category">Kategori</Label>
                  <Input
                    id="competition-category"
                    value={formData.category}
                    onChange={(event) => setFormData({ ...formData, category: event.target.value })}
                    placeholder="Nasional"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="competition-description">Deskripsi (opsional)</Label>
                  <Textarea
                    id="competition-description"
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    placeholder="Informasi singkat yang membantu anggota mengenali kompetisi."
                    rows={3}
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/25 p-4 sm:p-5">
                <div className="space-y-2">
                  <Label>Preset penilaian</Label>
                  <Select value={formData.templateId ?? 'custom'} onValueChange={applyTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Kustom sepenuhnya</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Mengganti preset akan mengisi ulang daftar capaian. Semua nilai tetap bisa diedit.
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Aturan capaian dan poin</p>
                      <p className="text-xs text-muted-foreground">Poin diberikan otomatis saat admin menyetujui.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setFormData((current) => ({
                        ...current,
                        rules: [...current.rules, { label: '', points: 0 }],
                      }))}
                    >
                      <Plus className="size-3.5" />
                      Tambah
                    </Button>
                  </div>

                  {formData.rules.map((rule, index) => (
                    <div key={rule.id ?? `new-${index}`} className="grid grid-cols-[1fr_7rem_auto] gap-2">
                      <Input
                        aria-label={`Nama capaian ${index + 1}`}
                        value={rule.label}
                        onChange={(event) => updateRule(index, { label: event.target.value })}
                        placeholder="Contoh: Juara 1"
                      />
                      <Input
                        aria-label={`Poin capaian ${index + 1}`}
                        type="number"
                        min="0"
                        max="100000"
                        step="1"
                        value={rule.points}
                        onChange={(event) => updateRule(index, {
                          points: event.target.value === '' ? '' : Number(event.target.value),
                        })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeRule(index)}
                        disabled={formData.rules.length === 1}
                        aria-label={`Hapus capaian ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                <div>
                  <Label htmlFor="competition-active">Buka untuk pengajuan</Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Kompetisi nonaktif tetap tersimpan, tetapi tidak muncul di formulir anggota.
                  </p>
                </div>
                <Switch
                  id="competition-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Simpan kompetisi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('title')} className="-ml-2 font-semibold">
                  Kompetisi <SortIcon field="title" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('category')} className="-ml-2 font-semibold">
                  Kategori <SortIcon field="category" />
                </Button>
              </TableHead>
              <TableHead>Skor</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('date')} className="-ml-2 font-semibold">
                  Tanggal <SortIcon field="date" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredCompetitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Belum ada kompetisi. Gunakan preset untuk membuat yang pertama.
                </TableCell>
              </TableRow>
            ) : sortedAndFilteredCompetitions.map((competition) => {
              const points = competition.scoring_rules.map((rule) => rule.points);
              const min = points.length ? Math.min(...points) : 0;
              const max = points.length ? Math.max(...points) : 0;

              return (
                <TableRow key={competition.id} className={!competition.is_active ? 'opacity-65' : undefined}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{competition.title}</span>
                        <Badge variant={competition.is_active ? 'default' : 'secondary'}>
                          {competition.is_active ? 'Aktif' : 'Diarsipkan'}
                        </Badge>
                      </div>
                      {competition.description && (
                        <p className="max-w-md line-clamp-1 text-sm text-muted-foreground">
                          {competition.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{competition.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{competition.scoring_rules.length} capaian</p>
                    <p className="text-xs text-muted-foreground">{min}–{max} poin</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="size-4" />
                      {format(new Date(competition.date), 'dd MMM yyyy')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(competition)} aria-label={`Edit ${competition.title}`}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleToggleActive(competition)}
                        aria-label={competition.is_active ? `Arsipkan ${competition.title}` : `Aktifkan ${competition.title}`}
                      >
                        {competition.is_active ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
