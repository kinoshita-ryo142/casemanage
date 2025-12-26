import { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'

type User = {
  id: string
  email: string
  display_name?: string
  user_type?: number
  created_at?: string
}

interface UserManagementViewProps {
  onClose: () => void
}

export default function UserManagementView({ onClose }: UserManagementViewProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editUserType, setEditUserType] = useState<number>(0)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserDisplayName, setNewUserDisplayName] = useState('')
  const [addUserLoading, setAddUserLoading] = useState(false)

  const toast = useToast()

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await (supabase as any)
        .from('profiles')
        .select('id, display_name, user_type, created_at')
        .order('created_at', { ascending: false })

      if (res.error) {
        console.error('fetchUsers error', res.error)
        setUsers([])
        return
      }

      // Get user emails from auth.users (may require admin access)
      // For now, we'll display profile data only
      const profileData = res.data ?? []
      setUsers(profileData.map((p: any) => ({
        id: p.id,
        email: '（メール取得不可）',
        display_name: p.display_name,
        user_type: p.user_type,
        created_at: p.created_at,
      })))
    } catch (err) {
      console.error('fetchUsers exception', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const startEditUserType = (userId: string, currentUserType: number) => {
    setEditingUserId(userId)
    setEditUserType(currentUserType || 0)
  }

  const saveUserType = async () => {
    if (editingUserId == null) return

    try {
      const res = await (supabase as any)
        .from('profiles')
        .update({ user_type: editUserType })
        .eq('id', editingUserId)
        .select()

      if (res.error) {
        toast(`更新に失敗しました: ${res.error.message}`,'error')
        console.error('update user_type error', res.error)
        return
      }

      toast('ユーザータイプを更新しました','success')
      cancelEdit()
      fetchUsers()
    } catch (err) {
      console.error('saveUserType exception', err)
      toast('更新中にエラーが発生しました','error')
    }
  }

  const cancelEdit = () => {
    setEditingUserId(null)
    setEditUserType(0)
  }

  const openAddUserModal = () => {
    setNewUserEmail('')
    setNewUserPassword('')
    setNewUserDisplayName('')
    setIsAddUserModalOpen(true)
  }

  const closeAddUserModal = () => {
    setIsAddUserModalOpen(false)
    setNewUserEmail('')
    setNewUserPassword('')
    setNewUserDisplayName('')
  }

  const saveNewUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast('メールアドレスとパスワードを入力してください','error')
      return
    }

    try {
      setAddUserLoading(true)

      // Create user in auth
      const signUpRes = await (supabase as any).auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
      })

      if (signUpRes.error) {
        toast(`ユーザー登録に失敗しました: ${signUpRes.error.message}`,'error')
        console.error('signUp error', signUpRes.error)
        return
      }

      const newUserId = signUpRes.data?.user?.id

      if (!newUserId) {
        toast('ユーザー作成に失敗しました','error')
        return
      }

      // Create profile entry
      const profileRes = await (supabase as any)
        .from('profiles')
        .insert({
          id: newUserId,
          display_name: newUserDisplayName || newUserEmail,
          user_type: 0, // Default to regular user
        })
        .select()

      if (profileRes.error) {
        console.error('Profile creation error:', profileRes.error)
        toast('プロファイル作成に失敗しました','error')
        return
      }

      toast('ユーザーを登録しました','success')
      closeAddUserModal()
      fetchUsers()
    } catch (err) {
      console.error('saveNewUser exception', err)
      toast('登録中にエラーが発生しました','error')
    } finally {
      setAddUserLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-card border border-border rounded-lg shadow-lg p-6 z-10 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">ユーザー管理</h3>
          <div className="flex gap-2">
            <Button onClick={openAddUserModal} className="bg-green-500 hover:bg-green-600 text-white">
              ＋ ユーザーの追加
            </Button>
            <Button variant="outline" onClick={onClose}>閉じる</Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">ユーザーがありません</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>表示名</TableHead>
                <TableHead>ユーザータイプ</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="text-sm text-muted-foreground font-mono">{user.id.substring(0, 8)}...</TableCell>
                  <TableCell>{user.display_name || '-'}</TableCell>
                  <TableCell>
                      {editingUserId === user.id ? (
                        <Select
                          onValueChange={(val) => setEditUserType(Number(val))}
                          defaultValue={String(editUserType)}
                        >
                          <SelectTrigger size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1: 管理者</SelectItem>
                            <SelectItem value="2">2: 担当者</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                      <span className="text-sm">
                        {user.user_type === 1 ? '1: 管理者' : '2: 担当者'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingUserId === user.id ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={saveUserType}>保存</Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>キャンセル</Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => startEditUserType(user.id, user.user_type || 0)}
                      >
                        編集
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 新規ユーザー追加モーダル */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeAddUserModal} />
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 z-10 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">新規ユーザーを追加</h3>
            <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); saveNewUser(); }}>
              <div className="space-y-3">
                {/* ダミーinputでブラウザの自動入力を吸収 */}
                <input
                  type="text"
                  name="fake-username"
                  autoComplete="username"
                  style={{ position: 'absolute', left: -9999, top: -9999 }}
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <input
                  type="password"
                  name="fake-password"
                  autoComplete="new-password"
                  style={{ position: 'absolute', left: -9999, top: -9999 }}
                  aria-hidden="true"
                  tabIndex={-1}
                />

                <div>
                  <label className="block text-sm font-medium mb-1">メールアドレス</label>
                  <Input
                    type="email"
                    name="add_user_email"
                    autoComplete="off"
                    value={newUserEmail}
                    onChange={(e: any) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">パスワード</label>
                  <Input
                    type="password"
                    name="add_user_password"
                    autoComplete="new-password"
                    value={newUserPassword}
                    onChange={(e: any) => setNewUserPassword(e.target.value)}
                    placeholder="パスワード"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">表示名</label>
                  <Input
                    type="text"
                    name="add_user_display_name"
                    autoComplete="off"
                    value={newUserDisplayName}
                    onChange={(e: any) => setNewUserDisplayName(e.target.value)}
                    placeholder="表示名（オプション）"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="submit" disabled={addUserLoading}>
                  {addUserLoading ? '登録中...' : '登録'}
                </Button>
                <Button variant="outline" onClick={closeAddUserModal}>キャンセル</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
