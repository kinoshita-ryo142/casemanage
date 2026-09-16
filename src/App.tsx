import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Session } from '@supabase/supabase-js'
import { Auth } from './Auth'
import { Button } from './components/ui/button'
import ClientForm from './components/ClientForm'
import ReportView from './components/ReportView'
import ProjectListView from './components/ProjectListView'
import UserManagementView from './components/UserManagementView'
import { ToastProvider, useToast } from './components/ui/toast'

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

type OnlineUser = {
  id: string
  display_name: string | null
  last_seen: string | null
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <ToastProvider>
      {!session ? <Auth /> : <Dashboard session={session} />}
    </ToastProvider>
  )
}

// アカウント編集モーダルを独立させて親の全描画を回避
function AccountModal({
  isOpen,
  onClose,
  initialName,
  userEmail,
  userId,
  onUpdated,
}: {
  isOpen: boolean
  onClose: () => void
  initialName: string
  userEmail: string
  userId: string
  onUpdated: (newName: string) => void
}) {
  const [accountName, setAccountName] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setAccountName(initialName)
  }, [initialName, isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    try {
      setLoading(true)
      const updates = { data: { full_name: accountName } }
      const res = await (supabase.auth as any).updateUser(updates)
      if (res.error) {
        toast(`更新に失敗しました: ${res.error.message}`, 'error')
        return
      }

      const profileRes = await (supabase as any)
        .from('profiles')
        .upsert({ id: userId, display_name: accountName }, { onConflict: 'id' })

      if (profileRes.error) {
        toast('プロファイルの更新に失敗しました', 'error')
        return
      }

      toast('アカウント情報を更新しました', 'success')
      onUpdated(accountName)
      onClose()
    } catch (err) {
      toast('更新中にエラーが発生しました', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-card border border-border rounded-lg shadow-lg p-6 z-10 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">アカウント情報の編集</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">メール</label>
            <input readOnly value={userEmail} className="w-full px-3 py-2 border rounded bg-muted text-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">表示名</label>
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-foreground bg-background"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ session }: { session: Session }) {
  const [view, setView] = useState<'list' | 'report' | 'client'>('report')
  const [projects, setProjects] = useState<Project[]>([])
  const [clientsForSelect, setClientsForSelect] = useState<Array<{ id: number; client_name: string }>>([])
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [accountName, setAccountName] = useState<string>(session.user.user_metadata?.full_name ?? '')
  const [reportRefreshKey, setReportRefreshKey] = useState<number>(0)
  const [userType, setUserType] = useState<number | null>(null)
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  // タイマー内のクロージャ問題を防ぐための Ref
  const accountNameRef = useRef(accountName)
  accountNameRef.current = accountName

  const presenceIntervalRef = useRef<number | null>(null)
  const presenceChannelRef = useRef<any>(null)
  const presenceProbeIntervalRef = useRef<number | null>(null)
  const presenceEnabledRef = useRef<boolean>(true)
  const PRESENCE_TTL = 60_000

  const fetchOnlineUsers = async () => {
    if (!presenceEnabledRef.current) return
    try {
      const cutoff = new Date(Date.now() - PRESENCE_TTL).toISOString()
      const res = await (supabase as any)
        .from('user_presence')
        .select('id, display_name, last_seen')
        .gt('last_seen', cutoff)

      if (res.error) {
        if (res.error.code === 'PGRST205' || /Could not find the table/i.test(res.error.message || '')) {
          presenceEnabledRef.current = false
          stopPresence()
          if (!presenceProbeIntervalRef.current) {
            presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
          }
        }
        setOnlineUsers([])
        return
      }
      setOnlineUsers(res.data ?? [])
    } catch (err: any) {
      if (/Could not find the table/i.test(err?.message || '')) {
        presenceEnabledRef.current = false
        stopPresence()
        if (!presenceProbeIntervalRef.current) {
          presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
        }
      }
      setOnlineUsers([])
    }
  }

  const upsertPresence = async (currentDisplayName?: string) => {
    if (!presenceEnabledRef.current) return
    const displayNameToUse = currentDisplayName ?? accountNameRef.current ?? session.user.user_metadata?.full_name ?? session.user.email
    try {
      const res = await (supabase as any)
        .from('user_presence')
        .upsert(
          { id: session.user.id, display_name: displayNameToUse, last_seen: new Date().toISOString() },
          { onConflict: 'id' }
        )
      if (res?.error) {
        if (res.error.code === 'PGRST205' || /Could not find the table/i.test(res.error.message || '')) {
          presenceEnabledRef.current = false
          stopPresence()
          if (!presenceProbeIntervalRef.current) {
            presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
          }
        }
      }
    } catch (err: any) {
      if (/Could not find the table/i.test(err?.message || '')) {
        presenceEnabledRef.current = false
        stopPresence()
        if (!presenceProbeIntervalRef.current) {
          presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
        }
      }
    }
  }

  const removePresence = async () => {
    if (!presenceEnabledRef.current) return
    try {
      await (supabase as any).from('user_presence').delete().eq('id', session.user.id)
    } catch (err: any) {
      // ignore
    }
  }

  const probePresence = async () => {
    try {
      const res = await (supabase as any).from('user_presence').select('id').limit(1)
      if (!res.error) {
        presenceEnabledRef.current = true
        if (presenceProbeIntervalRef.current) {
          clearInterval(presenceProbeIntervalRef.current)
          presenceProbeIntervalRef.current = null
        }
        startPresence()
      }
    } catch (err) {
      // ignore
    }
  }

  const startPresence = () => {
    if (!presenceEnabledRef.current) return

    if (presenceProbeIntervalRef.current) {
      clearInterval(presenceProbeIntervalRef.current)
      presenceProbeIntervalRef.current = null
    }

    upsertPresence()
    fetchOnlineUsers()

    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current)
    }

    presenceIntervalRef.current = window.setInterval(() => {
      upsertPresence()
      fetchOnlineUsers()
    }, 25_000)

    if (!presenceChannelRef.current) {
      try {
        presenceChannelRef.current = (supabase as any)
          .channel('presence')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => {
            fetchOnlineUsers()
          })
          .subscribe()
      } catch (e) {
        console.warn('presence channel setup failed', e)
      }
    }
  }

  const stopPresence = () => {
    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current)
      presenceIntervalRef.current = null
    }
    if (presenceChannelRef.current) {
      try {
        (supabase as any).removeChannel?.(presenceChannelRef.current)
      } catch {}
      presenceChannelRef.current = null
    }
    if (presenceProbeIntervalRef.current) {
      clearInterval(presenceProbeIntervalRef.current)
      presenceProbeIntervalRef.current = null
    }
    removePresence()
  }

  const fetchProjects = async () => {
    try {
      const res = await (supabase as any)
        .from('project')
        .select('id, created_at, created_user, project_name, project_status, client_id, project_outline, project_url, project_manhour, project_budget, project_result, project_deadline, project_delivery')
        .order('created_at', { ascending: false })

      if (res.error) {
        setProjects([])
        return
      }

      setProjects(res.data ?? [])
      setReportRefreshKey(prev => prev + 1)
    } catch (err) {
      setProjects([])
    }
  }

  const fetchClientsForSelect = async () => {
    try {
      const res = await (supabase as any)
        .from('client')
        .select('id, client_name')
        .order('created_at', { ascending: false })

      if (res.error) {
        setClientsForSelect([])
        return
      }
      setClientsForSelect(res.data ?? [])
    } catch (err) {
      setClientsForSelect([])
    }
  }

  const fetchUserType = async () => {
    try {
      const res = await (supabase as any)
        .from('profiles')
        .select('user_type')
        .eq('id', session.user.id)
        .single()

      if (res.error) {
        setUserType(null)
        return
      }
      setUserType(res.data?.user_type ?? null)
    } catch (err) {
      setUserType(null)
    }
  }

  useEffect(() => {
    fetchProjects()
    fetchClientsForSelect()
    fetchUserType()
    startPresence()

    const beforeUnload = () => {
      removePresence()
    }
    window.addEventListener('beforeunload', beforeUnload)

    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      stopPresence()
    }
  }, [])

  const handleLogout = async () => {
    stopPresence()
    await supabase.auth.signOut()
  }

  const handleAccountUpdated = (newName: string) => {
    setAccountName(newName)
    accountNameRef.current = newName
    upsertPresence(newName)
  }

  const otherOnlineUsers = onlineUsers.filter(u => u.id !== session.user.id)

  return (
    <div className="min-h-screen bg-linear-to-br from-background to-muted p-8">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">工数管理システム</h1>
            <p className="text-muted-foreground mt-1">
              ログイン中：<span className="font-medium text-primary">{accountName || session.user.user_metadata?.full_name || session.user.email}</span>
              {otherOnlineUsers.length > 0 && (
                <span className="ml-3 text-sm text-muted-foreground">
                  他オンライン: <span className="font-medium text-primary">{otherOnlineUsers.map(u => u.display_name || u.id).join(', ')}</span>
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {userType === 1 && (
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white"
                variant="default"
                onClick={() => setIsUserManagementOpen(true)}
              >
                ユーザー管理
              </Button>
            )}
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              variant="default"
              onClick={() => setIsAccountOpen(true)}
            >
              アカウント
            </Button>
            <Button onClick={handleLogout} className="text-red-500 font-semibold" variant="ghost">
              ログアウト
            </Button>
          </div>
        </div>

        <AccountModal
          isOpen={isAccountOpen}
          onClose={() => setIsAccountOpen(false)}
          initialName={accountName}
          userEmail={session.user.email ?? ''}
          userId={session.user.id}
          onUpdated={handleAccountUpdated}
        />

        <div className="bg-card border border-border rounded-lg shadow-md p-6">
          <div className="flex gap-2 mb-6">
            <Button onClick={() => setView('report')} variant={view === 'report' ? 'default' : 'ghost'}>集計</Button>
            <Button onClick={() => setView('list')} variant={view === 'list' ? 'default' : 'ghost'}>案件管理</Button>
            <Button onClick={() => setView('client')} variant={view === 'client' ? 'default' : 'ghost'}>クライアント管理</Button>
          </div>

          {view === 'list' && (
            <ProjectListView
              projects={projects}
              clientsForSelect={clientsForSelect}
              onProjectsChange={fetchProjects}
            />
          )}

          {view === 'report' && (
            <ReportView key={reportRefreshKey} />
          )}

          {view === 'client' && (
            <div>
              <ClientForm onSaved={fetchClientsForSelect} />
            </div>
          )}
        </div>

        {isUserManagementOpen && (
          <UserManagementView onClose={() => setIsUserManagementOpen(false)} />
        )}
      </div>
    </div>
  )
}