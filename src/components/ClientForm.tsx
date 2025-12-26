import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { useToast } from './ui/toast'

type Client = {
  id?: number | string
  created_at?: string | null
  client_name: string
  client_person?: string | null
  client_tel?: string | null
  client_mail?: string | null
  client_note?: string | null
}

export default function ClientForm({
  onSaved,
  initial,
}: {
  onSaved?: () => void
  initial?: Client | null
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [editingClient, setEditingClient] = useState<Client | null>(initial ?? null)

  const [name, setName] = useState('')
  const [person, setPerson] = useState('')
  const [tel, setTel] = useState('')
  const [mail, setMail] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const toast = useToast()

  const fetchClients = async () => {
    try {
      const res = await (supabase as any)
        .from('client')
        .select('id, created_at, client_name, client_person, client_tel, client_mail, client_note')
        .order('created_at', { ascending: false })

      if (res.error) {
        console.error('fetchClients error', res.error)
        setClients([])
        return
      }
      setClients(res.data ?? [])
    } catch (err) {
      console.error('fetchClients exception', err)
      setClients([])
    }
  }

  // Load clients on mount
  useEffect(() => {
    fetchClients()
  }, [])

  // Update fields when editingClient or initial changes
  useEffect(() => {
    const src = editingClient ?? initial
    setName(src?.client_name ?? '')
    setPerson(src?.client_person ?? '')
    setTel(src?.client_tel ?? '')
    setMail(src?.client_mail ?? '')
    setNote(src?.client_note ?? '')
    if (src) setModalOpen(true)
  }, [editingClient, initial])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast('クライアント名を入力してください','error')
      return
    }
    setLoading(true)
    try {
      const payload: any = {
        client_name: name.trim(),
        client_person: person.trim() || null,
        client_tel: tel.trim() || null,
        client_mail: mail.trim() || null,
        client_note: note.trim() || null,
      }

      let res: any
      const targetId = editingClient?.id ?? initial?.id
      if (targetId != null) {
        res = await (supabase as any).from('client').update(payload).eq('id', targetId).select()
      } else {
        res = await (supabase as any).from('client').insert(payload).select()
      }

      if (res.error) {
        console.error('client upsert error', res.error)
        toast(`クライアントの保存に失敗しました: ${res.error.message}`,'error')
        return
      }
      toast(targetId != null ? 'クライアントを更新しました' : 'クライアントを登録しました','success')
      setName('')
      setPerson('')
      setTel('')
      setMail('')
      setNote('')
      onSaved?.()
      setModalOpen(false)
      setEditingClient(null)
      // refresh list
      await fetchClients()
    } catch (err) {
      console.error('client save exception', err)
      toast('クライアント保存中にエラーが発生しました','error')
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = () => {
    setShowDeleteConfirm(true)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  const deleteClient = async () => {
    const targetId = editingClient?.id ?? initial?.id
    if (targetId == null) return
    setLoading(true)
    try {
      // 先に案件テーブルをチェックして、紐づく案件があれば削除をキャンセルする
      const projectsRes = await (supabase as any)
        .from('project')
        .select('id')
        .eq('client_id', targetId)
        .limit(1)

      if (projectsRes.error) {
        console.error('project check error', projectsRes.error)
        toast(`削除に失敗しました: ${projectsRes.error.message}`,'error')
        setShowDeleteConfirm(false)
        return
      }

      if (projectsRes.data && projectsRes.data.length > 0) {
        // 案件が存在するため削除をキャンセル
        toast('既に登録されている案件があるため、削除できませんでした。','error')
        setShowDeleteConfirm(false)
        // 編集モーダルを閉じてフォームをリセット（誤って保存が走るのを防ぐ）
        setModalOpen(false)
        setEditingClient(null)
        setName('')
        setPerson('')
        setTel('')
        setMail('')
        setNote('')
        // 念のためフォーカスを外す
        try { (document.activeElement as HTMLElement | null)?.blur() } catch (e) {}
        return
      }

      const res = await (supabase as any).from('client').delete().eq('id', targetId).select()
      if (res.error) {
        console.error('client delete error', res.error)
        toast(`削除に失敗しました: ${res.error.message}`,'error')
        setShowDeleteConfirm(false)
        return
      }
      toast('クライアントを削除しました','success')
      setShowDeleteConfirm(false)
      setModalOpen(false)
      setEditingClient(null)
      onSaved?.()
      await fetchClients()
    } catch (err) {
      console.error('client delete exception', err)
      toast('削除中にエラーが発生しました','error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-foreground">クライアント一覧</h2>
        <div>
          <Button variant="default" onClick={() => { setEditingClient(null); setModalOpen(true); }}>＋ 追加</Button>
        </div>
      </div>

      <div className="overflow-auto mb-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-card text-sm border-b">
              <th className="px-4 py-2 text-left text-muted-foreground">ID</th>
              <th className="px-4 py-2 text-left text-muted-foreground">クライアント名</th>
              <th className="px-4 py-2 text-left text-muted-foreground">担当者</th>
              <th className="px-4 py-2 text-right text-muted-foreground">編集</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={String(c.id)} className="border-b">
                <td className="px-4 py-2 text-sm text-muted-foreground">{c.id}</td>
                <td className="px-4 py-2 text-sm text-foreground">{c.client_name}</td>
                <td className="px-4 py-2 text-sm text-foreground">{c.client_person ?? '-'}</td>
                <td className="px-4 py-2 text-sm text-right">
                  <Button size="sm" onClick={() => { setEditingClient(c); setModalOpen(true); }}>編集</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 z-10 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">{editingClient?.id != null ? 'クライアントを編集' : 'クライアント追加'}</h3>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">クライアント名</label>
                <Input value={name} onChange={(e: any) => setName(e.target.value)} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">担当者</label>
                <Input value={person} onChange={(e: any) => setPerson(e.target.value)} className="w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">電話</label>
                  <Input value={tel} onChange={(e: any) => setTel(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">メール</label>
                  <Input value={mail} onChange={(e: any) => setMail(e.target.value)} className="w-full" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">備考</label>
                <Textarea value={note} onChange={(e: any) => setNote(e.target.value)} className="w-full" />
              </div>
              <div className="flex justify-between items-center gap-2 mt-4">
                <div>
                  {editingClient?.id != null && (
                    <Button type="button" variant="destructive" onClick={confirmDelete}>削除</Button>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="submit" disabled={loading}>{loading ? '保存中...' : (editingClient?.id != null ? '保存' : '登録')}</Button>
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>キャンセル</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete} />
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 z-20 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">削除の確認</h3>
            <p className="mb-4">クライアント名: <strong>{name || editingClient?.client_name}</strong><br/>削除してもよろしいですか？<br/>※削除されたデータは復元できません。</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="destructive" onClick={deleteClient}>削除する</Button>
              <Button type="button" variant="outline" onClick={cancelDelete}>キャンセル</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
