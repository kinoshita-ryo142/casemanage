import { useState } from 'react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { ArrowUpDown } from 'lucide-react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import statusList from '../data/status.json'

type Project = {
  id: number | string
  created_at: string | null
  created_user?: string | null
  project_name: string
  project_status: number
  client_id?: number | null
  project_outline?: string | null
  project_url?: string | null
  project_manhour?: number | null
  project_budget?: number | null
  project_result?: number | null
  project_deadline?: string | null
  project_delivery?: string | null
}

interface ProjectListViewProps {
  projects: Project[]
  clientsForSelect: Array<{ id: number; client_name: string }>
  onProjectsChange: () => void
}

export default function ProjectListView({
  projects,
  clientsForSelect,
  onProjectsChange,
}: ProjectListViewProps) {
  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Modal/Edit state
  const [editingProjectId, setEditingProjectId] = useState<number | string | null>(null)
  const [editCreatedAt, setEditCreatedAt] = useState<string>('')
  const [editCreatedUserName, setEditCreatedUserName] = useState<string>('')
  const [editTitle, setEditTitle] = useState('')
  const [editStatus, setEditStatus] = useState<number>(0)
  const [editManhour, setEditManhour] = useState<string>('')
  const [editBudget, setEditBudget] = useState<string>('')
  const [editManhourError, setEditManhourError] = useState<string>('')
  const [editBudgetError, setEditBudgetError] = useState<string>('')
  const [editResult, setEditResult] = useState<string>('')
  const [editResultError, setEditResultError] = useState<string>('')
  const [editClientId, setEditClientId] = useState<number | null>(null)
  const [editOutline, setEditOutline] = useState<string>('')
  const [editUrl, setEditUrl] = useState<string>('')
  const [editDeadline, setEditDeadline] = useState<string>('')
  const [editDelivery, setEditDelivery] = useState<string>('')
  const [showEditDeadlineCalendar, setShowEditDeadlineCalendar] = useState(false)
  const [showEditDeliveryCalendar, setShowEditDeliveryCalendar] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const toast = useToast()

  // 新規登録用の state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStatus, setNewStatus] = useState<number>(0)
  const [newManhour, setNewManhour] = useState<string>('')
  const [newBudget, setNewBudget] = useState<string>('')
  const [newManhourError, setNewManhourError] = useState<string>('')
  const [newBudgetError, setNewBudgetError] = useState<string>('')
  const [newResult, setNewResult] = useState<string>('')
  const [newResultError, setNewResultError] = useState<string>('')
  const [newClientId, setNewClientId] = useState<number | null>(null)
  const [newOutline, setNewOutline] = useState<string>('')
  const [newUrl, setNewUrl] = useState<string>('')
  const [newDeadline, setNewDeadline] = useState<string>('')
  const [newDelivery, setNewDelivery] = useState<string>('')
  const [showNewDeadlineCalendar, setShowNewDeadlineCalendar] = useState(false)
  const [showNewDeliveryCalendar, setShowNewDeliveryCalendar] = useState(false)

  // 編集開始
  const startEdit = (p: Project) => {
    setEditingProjectId(p.id)
    setEditCreatedAt(p.created_at ?? '')
    // try to resolve created_user -> user's display name from profiles table
    setEditCreatedUserName('')
    if (p.created_user) {
      ;(async () => {
        try {
          const res = await (supabase as any)
            .from('profiles')
            .select('display_name')
            .eq('id', p.created_user)
            .single()
          if (!res.error && res.data?.display_name) {
            setEditCreatedUserName(res.data.display_name)
          } else {
            setEditCreatedUserName(String(p.created_user))
          }
        } catch (err) {
          console.error('Failed to fetch user profile:', err)
          setEditCreatedUserName(String(p.created_user))
        }
      })()
    }
    setEditTitle(p.project_name)
    setEditStatus(Number(p.project_status) || 0)
    setEditManhour(p.project_manhour != null ? String(p.project_manhour) : '')
    setEditBudget(p.project_budget != null ? String(p.project_budget) : '')
    setEditResult(p.project_result != null ? String(p.project_result) : '')
    setEditClientId(p.client_id ?? null)
    setEditOutline(p.project_outline ?? '')
    setEditUrl(p.project_url ?? '')
    setEditDeadline(p.project_deadline ?? '')
    setEditDelivery(p.project_delivery ?? '')
  }

  const cancelEdit = () => {
    setEditingProjectId(null)
    setEditTitle('')
    setEditStatus(0)
    setEditCreatedAt('')
    setEditClientId(null)
    setEditOutline('')
    setEditUrl('')
    setEditDeadline('')
    setEditDelivery('')
    setEditManhour('')
    setEditBudget('')
    setEditResult('')
    setEditManhourError('')
    setEditBudgetError('')
    setEditResultError('')
  }

  // --- Input sanitizers: keep only half-width digits
  const sanitizeDecimal = (v: string) => {
    if (!v) return ''
    // remove any character that's not 0-9 or dot
    let s = v.replace(/[^0-9.]/g, '')
    // keep only first dot
    const parts = s.split('.')
    if (parts.length <= 1) return parts[0]
    return parts.shift() + '.' + parts.join('')
  }

  const sanitizeInteger = (v: string) => {
    if (!v) return ''
    // remove anything that's not 0-9
    return v.replace(/[^0-9]/g, '')
  }

  // テーブルカラム定義
  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: 'id',
      header: () => <div className="w-12 text-muted-foreground">ID</div>,
      cell: (info) => <div className="w-12 text-muted-foreground">{String(info.getValue())}</div>,
    },
    {
      accessorKey: 'client_id',
      header: () => <div className="w-32">クライアント</div>,
      cell: (info) => {
        const id = info.getValue() as number | null
        const client = clientsForSelect.find((c) => c.id === id)
        return <div className="w-32">{client?.client_name ?? '-'}</div>
      },
    },
    {
      accessorKey: 'project_name',
      header: () => <div className="w-[40%]">案件名</div>,
      cell: (info) => <div className="w-[40%]">{String(info.getValue())}</div>,
      enableSorting: true,
      enableColumnFilter: true,
    },
    {
      accessorKey: 'project_budget',
      header: () => <div className="w-32 text-right">予算 (円)</div>,
      cell: (info) => {
        const val = info.getValue() as number | null
        return <div className="w-32 text-right">{val != null ? Number(val).toLocaleString() : '-'}</div>
      },
    },
    {
      accessorKey: 'project_result',
      header: () => <div className="w-32 text-right">実績 (円)</div>,
      cell: (info) => {
        const val = info.getValue() as number | null
        return <div className="w-32 text-right">{val != null ? Number(val).toLocaleString() : '-'}</div>
      },
    },
    {
      accessorKey: 'project_status',
      header: () => <div className="w-28 text-center">ステータス</div>,
      cell: (info) => {
        const s = Number(info.getValue())
        const projectId = info.row.original.id
        const colorMap: Record<number, string> = {
          0: 'text-muted-foreground',
          1: 'text-blue-600',
          2: 'text-amber-600',
          3: 'text-purple-600',
          4: 'text-green-600',
        }
        return (
          <div className="w-28 text-center">
            <Select value={String(s)} onValueChange={(val) => { (async () => {
              const newStatus = Number(val)
              const res = await (supabase as any)
                .from('project')
                .update({ project_status: newStatus })
                .eq('id', projectId)
                .select()
              if (res.error) {
                toast(`ステータスの更新に失敗しました: ${res.error.message}`,'error')
                console.error('update status error', res.error)
                return
              }
              toast('ステータスを更新しました','success')
              onProjectsChange()
            })() }}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusList.map((label, idx) => (
                  <SelectItem key={idx} value={String(idx)}><span className={colorMap[idx] ?? ''}>{label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      },
      enableSorting: true,
    },
    {
      id: 'actions',
      header: () => <div className="w-20 text-center">編集</div>,
      cell: (info) => (
        <div className="w-20 text-center">
          <Button onClick={() => startEdit(info.row.original)} size="sm">編集</Button>
        </div>
      ),
    },
  ]

  const filteredProjects = projects

  // TanStack Tableインスタンス作成
  const table = useReactTable({
    data: filteredProjects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  })

  const saveEdit = async () => {
    if (editingProjectId == null) return
    const payload: any = {
      project_name: editTitle,
      project_status: Number(editStatus),
      client_id: editClientId,
      project_outline: editOutline || null,
      project_url: editUrl || null,
      project_deadline: editDeadline || null,
      project_delivery: editDelivery || null,
        project_manhour: editManhour === '' ? null : Number(editManhour),
        project_budget: editBudget === '' ? null : Number(editBudget),
        project_result: editResult === '' ? null : Number(editResult),
    }

      // prevent saving if any validation errors present
      if (editManhourError || editBudgetError || editResultError) {
        toast('数値の入力に誤りがあります。入力を修正してください。','error')
        return
      }

    const res = await (supabase as any)
      .from('project')
      .update(payload)
      .eq('id', editingProjectId)
      .select()

    if (res.error) {
      toast(`更新に失敗しました: ${res.error.message}`,'error')
      console.error('update project error', res.error)
      return
    }

    cancelEdit()
    onProjectsChange()
  }

  const confirmDelete = () => {
    setShowDeleteConfirm(true)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  const deleteProject = async () => {
    if (editingProjectId == null) return
    const res = await (supabase as any)
      .from('project')
      .delete()
      .eq('id', editingProjectId)
      .select()

    if (res.error) {
      toast(`削除に失敗しました: ${res.error.message}`,'error')
      console.error('delete project error', res.error)
      setShowDeleteConfirm(false)
      return
    }

    setShowDeleteConfirm(false)
    cancelEdit()
    onProjectsChange()
  }

  const formatDateYMD = (iso?: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const dd = d.getDate()
    return `${y}年${m}月${dd}日`
  }

  const openNewModal = () => {
    setIsNewModalOpen(true)
  }

  const closeNewModal = () => {
    setIsNewModalOpen(false)
    setNewTitle('')
    setNewStatus(0)
    setNewManhour('')
    setNewBudget('')
    setNewResult('')
    setNewManhourError('')
    setNewBudgetError('')
    setNewResultError('')
    setNewClientId(null)
    setNewOutline('')
    setNewUrl('')
    setNewDeadline('')
    setNewDelivery('')
    setShowNewDeadlineCalendar(false)
    setShowNewDeliveryCalendar(false)
  }

  const saveNewProject = async () => {
    // get current user id and include as created_user
    const { data: { user } } = await (supabase as any).auth.getUser()

    const payload: any = {
      project_name: newTitle,
      project_status: Number(newStatus),
      client_id: newClientId,
      project_outline: newOutline || null,
      project_url: newUrl || null,
      project_deadline: newDeadline || null,
      project_delivery: newDelivery || null,
      project_manhour: newManhour === '' ? null : Number(newManhour),
      project_budget: newBudget === '' ? null : Number(newBudget),
      project_result: newResult === '' ? null : Number(newResult),
      created_user: user?.id ?? null,
    }

    // prevent saving if any validation errors present
    if (newManhourError || newBudgetError || newResultError) {
      toast('数値の入力に誤りがあります。入力を修正してください。','error')
      return
    }

    const res = await (supabase as any)
      .from('project')
      .insert(payload)
      .select()

    if (res.error) {
      toast(`登録に失敗しました: ${res.error.message}`,'error')
      console.error('insert project error', res.error)
      return
    }

    closeNewModal()
    onProjectsChange()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-foreground">案件一覧</h2>
        <div>
          <Button onClick={openNewModal} variant="default">＋ 案件追加</Button>
        </div>
      </div>
          <div className="mb-4 flex gap-2 flex-wrap items-end">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">案件名で検索</label>
              <Input
                placeholder="案件名..."
                value={(table.getColumn('project_name')?.getFilterValue() as string) ?? ''}
                onChange={(e: any) =>
                  table.getColumn('project_name')?.setFilterValue(e.target.value)
                }
              />
            </div>
          </div>
      <div className="space-y-4">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">案件がまだありません。</p>
            <p className="text-sm mt-2">「案件登録」から追加してください。</p>
          </div>
        ) : (
          <>
            <Table className="table-fixed">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      let headClassName = ''
                      if (header.column.id === 'actions' || header.column.id === 'project_status') {
                        headClassName = 'text-center'
                      }
                      return (
                        <TableHead key={header.id} className={headClassName}>
                          {header.isPlaceholder ? null : (
                            <div
                              className={
                                header.column.getCanSort()
                                  ? 'cursor-pointer select-none flex items-center gap-2'
                                  : ''
                              }
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {header.column.getCanSort() &&
                                (header.column.getIsSorted() ? (
                                  header.column.getIsSorted() === 'desc' ? (
                                    <ArrowUpDown className="h-4 w-4" />
                                  ) : (
                                    <ArrowUpDown className="h-4 w-4" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-4 w-4 opacity-50" />
                                ))}
                            </div>
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* 編集モーダル */}
            {editingProjectId != null && (
              <>
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/40" onClick={cancelEdit} />
                  <div className="bg-card border border-border rounded-lg shadow-lg p-6 z-10 w-full max-w-2xl">
                    <h3 className="text-lg font-semibold mb-4">案件を編集</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">作成日</label>
                          <div className="w-full px-3 py-2 border rounded bg-muted text-foreground">{formatDateYMD(editCreatedAt)}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">作成者</label>
                          <div className="w-full px-3 py-2 border rounded bg-muted text-foreground">{editCreatedUserName || '-'}</div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">案件名</label>
                        <Input className="w-full" value={editTitle} onChange={(e: any) => setEditTitle(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">クライアント</label>
                        <Select
                          defaultValue={editClientId != null ? String(editClientId) : undefined}
                          onValueChange={(val) => setEditClientId(val === '__none__' ? null : Number(val))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" disabled>-- 未選択 --</SelectItem>
                            {clientsForSelect.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.client_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">ステータス</label>
                          <Select
                            defaultValue={String(editStatus)}
                            onValueChange={(val) => setEditStatus(Number(val))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusList.map((label, idx) => (
                                <SelectItem key={idx} value={String(idx)}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">工数 (h)</label>
                          <Input
                            className="w-full text-right"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            value={editManhour}
                            onChange={(e: any) => {
                              const raw = e.target.value ?? ''
                              const sanitized = sanitizeDecimal(raw)
                              setEditManhour(sanitized)
                              setEditManhourError(raw !== sanitized ? '半角数字と小数点のみ入力できます' : '')
                            }}
                          />
                          {editManhourError && <p className="text-sm text-destructive mt-1">{editManhourError}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">予算 (円)</label>
                          <Input
                            className="w-full text-right"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={editBudget}
                            onChange={(e: any) => {
                              const raw = e.target.value ?? ''
                              const sanitized = sanitizeInteger(raw)
                              setEditBudget(sanitized)
                              setEditBudgetError(raw !== sanitized ? '半角数字のみ入力できます' : '')
                            }}
                          />
                          {editBudgetError && <p className="text-sm text-destructive mt-1">{editBudgetError}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">実績 (円)</label>
                          <Input
                            className="w-full text-right"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={editResult}
                            onChange={(e: any) => {
                              const raw = e.target.value ?? ''
                              const sanitized = sanitizeInteger(raw)
                              setEditResult(sanitized)
                              setEditResultError(raw !== sanitized ? '半角数字のみ入力できます' : '')
                            }}
                          />
                          {editResultError && <p className="text-sm text-destructive mt-1">{editResultError}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">納品予定日</label>
                          <div className="relative">
                            <Input
                              type="text"
                              readOnly
                              value={editDeadline ? new Date(editDeadline).toLocaleDateString('ja-JP') : ''}
                              placeholder="日付を選択"
                              onClick={() => setShowEditDeadlineCalendar(!showEditDeadlineCalendar)}
                              className="w-full cursor-pointer"
                            />
                            {showEditDeadlineCalendar && (
                              <div className="absolute top-full mt-2 bg-card border border-border rounded-lg shadow-lg p-4 z-20">
                                <Calendar
                                  mode="single"
                                  selected={editDeadline ? new Date(editDeadline) : undefined}
                                  onSelect={(date) => {
                                    if (date) {
                                      const year = date.getFullYear()
                                      const month = String(date.getMonth() + 1).padStart(2, '0')
                                      const day = String(date.getDate()).padStart(2, '0')
                                      setEditDeadline(`${year}-${month}-${day}`)
                                    }
                                    setShowEditDeadlineCalendar(false)
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">納品日</label>
                          <div className="relative">
                            <Input
                              type="text"
                              readOnly
                              value={editDelivery ? new Date(editDelivery).toLocaleDateString('ja-JP') : ''}
                              placeholder="日付を選択"
                              onClick={() => setShowEditDeliveryCalendar(!showEditDeliveryCalendar)}
                              className="w-full cursor-pointer"
                            />
                            {showEditDeliveryCalendar && (
                              <div className="absolute top-full mt-2 bg-card border border-border rounded-lg shadow-lg p-4 z-20">
                                <Calendar
                                  mode="single"
                                  selected={editDelivery ? new Date(editDelivery) : undefined}
                                  onSelect={(date) => {
                                    if (date) {
                                      const year = date.getFullYear()
                                      const month = String(date.getMonth() + 1).padStart(2, '0')
                                      const day = String(date.getDate()).padStart(2, '0')
                                      setEditDelivery(`${year}-${month}-${day}`)
                                    }
                                    setShowEditDeliveryCalendar(false)
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">URL</label>
                          <Input className="w-full" value={editUrl} onChange={(e: any) => setEditUrl(e.target.value)} />
                        </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">概要</label>
                        <Textarea className="w-full" value={editOutline} onChange={(e: any) => setEditOutline(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center gap-2 mt-4">
                      <div>
                        <Button variant="destructive" onClick={confirmDelete}>削除</Button>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button onClick={saveEdit}>保存</Button>
                        <Button variant="outline" onClick={cancelEdit}>キャンセル</Button>
                      </div>
                    </div>
                  </div>
                </div>

                {showDeleteConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={cancelDelete} />
                    <div className="bg-card border border-border rounded-lg shadow-lg p-6 z-20 w-full max-w-md">
                      <h3 className="text-lg font-semibold mb-2">削除の確認</h3>
                      <p className="mb-4">案件名: <strong>{editTitle}</strong><br/>削除してもよろしいですか？<br/>※削除されたデータは復元できません。</p>
                      <div className="flex justify-end gap-2">
                        <Button variant="destructive" onClick={deleteProject}>削除する</Button>
                        <Button variant="outline" onClick={cancelDelete}>キャンセル</Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}          </>
        )}
      </div>

      {/* 新規登録モーダル */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeNewModal} />
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 z-10 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">新規案件を登録</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">案件名<strong className="text-red-500">*</strong></label>
                <Input className="w-full" value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">クライアント</label>
                    <Select
                      defaultValue={newClientId != null ? String(newClientId) : undefined}
                      onValueChange={(val) => setNewClientId(val === '__none__' ? null : Number(val))}
                    >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="__none__" disabled>-- 未選択 --</SelectItem>
                    {clientsForSelect.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.client_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">ステータス</label>
                    <Select
                      defaultValue={String(newStatus)}
                      onValueChange={(val) => setNewStatus(Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusList.map((label, idx) => (
                          <SelectItem key={idx} value={String(idx)}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">工数 (h)</label>
                    <Input
                      className="w-full text-right"
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      value={newManhour}
                      onChange={(e: any) => {
                        const raw = e.target.value ?? ''
                        const sanitized = sanitizeDecimal(raw)
                        setNewManhour(sanitized)
                        setNewManhourError(raw !== sanitized ? '半角数字と小数点のみ入力できます' : '')
                      }}
                    />
                    {newManhourError && <p className="text-sm text-destructive mt-1">{newManhourError}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">予算 (円)</label>
                  <Input
                    className="w-full text-right"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newBudget}
                    onChange={(e: any) => {
                      const raw = e.target.value ?? ''
                      const sanitized = sanitizeInteger(raw)
                      setNewBudget(sanitized)
                      setNewBudgetError(raw !== sanitized ? '半角数字のみ入力できます' : '')
                    }}
                  />
                  {newBudgetError && <p className="text-sm text-destructive mt-1">{newBudgetError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">実績 (円)</label>
                  <Input
                    className="w-full text-right"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newResult}
                    onChange={(e: any) => {
                      const raw = e.target.value ?? ''
                      const sanitized = sanitizeInteger(raw)
                      setNewResult(sanitized)
                      setNewResultError(raw !== sanitized ? '半角数字のみ入力できます' : '')
                    }}
                  />
                  {newResultError && <p className="text-sm text-destructive mt-1">{newResultError}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">納品予定日</label>
                  <div className="relative">
                    <Input
                      type="text"
                      readOnly
                      value={newDeadline ? new Date(newDeadline).toLocaleDateString('ja-JP') : ''}
                      placeholder="日付を選択"
                      onClick={() => setShowNewDeadlineCalendar(!showNewDeadlineCalendar)}
                      className="w-full cursor-pointer"
                    />
                    {showNewDeadlineCalendar && (
                      <div className="absolute top-full mt-2 bg-card border border-border rounded-lg shadow-lg p-4 z-20">
                        <Calendar
                          mode="single"
                          selected={newDeadline ? new Date(newDeadline) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const year = date.getFullYear()
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const day = String(date.getDate()).padStart(2, '0')
                              setNewDeadline(`${year}-${month}-${day}`)
                            }
                            setShowNewDeadlineCalendar(false)
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">納品日</label>
                  <div className="relative">
                    <Input
                      type="text"
                      readOnly
                      value={newDelivery ? new Date(newDelivery).toLocaleDateString('ja-JP') : ''}
                      placeholder="日付を選択"
                      onClick={() => setShowNewDeliveryCalendar(!showNewDeliveryCalendar)}
                      className="w-full cursor-pointer"
                    />
                    {showNewDeliveryCalendar && (
                      <div className="absolute top-full mt-2 bg-card border border-border rounded-lg shadow-lg p-4 z-20">
                        <Calendar
                          mode="single"
                          selected={newDelivery ? new Date(newDelivery) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const year = date.getFullYear()
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const day = String(date.getDate()).padStart(2, '0')
                              setNewDelivery(`${year}-${month}-${day}`)
                            }
                            setShowNewDeliveryCalendar(false)
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <Input className="w-full" value={newUrl} onChange={(e: any) => setNewUrl(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">概要</label>
                <Textarea className="w-full" value={newOutline} onChange={(e: any) => setNewOutline(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={saveNewProject}>登録</Button>
              <Button variant="outline" onClick={closeNewModal}>キャンセル</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
