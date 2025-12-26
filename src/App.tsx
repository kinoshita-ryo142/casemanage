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


function App() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    // 1. 起動時に現在のセッション情報を取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // 2. ログイン/ログアウトの変更を監視（リアルタイム）
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <ToastProvider>
      {!session ? <Auth /> : <TodoList session={session} />}
    </ToastProvider>
  )
}

// （簡易的なTodoリストコンポーネント。分離してもOKです）
function TodoList({ session }: { session: Session }) {
  const [view, setView] = useState<'list' | 'report' | 'client'>('report')
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

  const [projects, setProjects] = useState<Project[]>([])
  const [clientsForSelect, setClientsForSelect] = useState<Array<{id:number, client_name:string}>>([])
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [accountName, setAccountName] = useState<string>(session.user.user_metadata?.full_name ?? '')
  const [accountLoading, setAccountLoading] = useState(false)
  const [reportRefreshKey, setReportRefreshKey] = useState<number>(0)
  const [userType, setUserType] = useState<number | null>(null)
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false)

  // presence: 他にオンラインのユーザーを表示するための状態
  const [onlineUsers, setOnlineUsers] = useState<Array<{id:string, display_name:string | null, last_seen: string | null}>>([])
  const presenceIntervalRef = useRef<number | null>(null)
  const presenceChannelRef = useRef<any>(null)
  const presenceProbeIntervalRef = useRef<number | null>(null)
  const presenceEnabledRef = useRef<boolean>(true)
  const PRESENCE_TTL = 60_000 // 60秒以内に更新があればオンラインとみなす

  const fetchOnlineUsers = async () => {
    if (!presenceEnabledRef.current) return
    try {
      const cutoff = new Date(Date.now() - PRESENCE_TTL).toISOString()
      const res = await (supabase as any)
        .from('user_presence')
        .select('id, display_name, last_seen')
        .gt('last_seen', cutoff)

      if (res.error) {
        console.error('fetchOnlineUsers error', res.error)
        // テーブルが存在しない場合、PostgREST は PGRST205 を返します -> presence を無効化
        if (res.error.code === 'PGRST205' || /Could not find the table/i.test(res.error.message || '')) {
          console.warn('user_presence table not found; disabling presence feature')
          presenceEnabledRef.current = false
          await stopPresence()
          // 見つかれば自動で再有効化するためにプローブを開始
          if (!presenceProbeIntervalRef.current) {
            probePresence()
            presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
          }
        }
        setOnlineUsers([])
        return
      }
      setOnlineUsers(res.data ?? [])
    } catch (err: any) {
      console.error('fetchOnlineUsers exception', err)
      // 似たようなエラーは presence を無効化
      if (/Could not find the table/i.test(err?.message || '')) {
        console.warn('user_presence table not found (exception); disabling presence feature')
        presenceEnabledRef.current = false
        await stopPresence()
        if (!presenceProbeIntervalRef.current) {
          probePresence()
          presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
        }
      }
      setOnlineUsers([])
    }
  }

  const upsertPresence = async () => {
    if (!presenceEnabledRef.current) return
    try {
      const res = await (supabase as any)
        .from('user_presence')
        .upsert({ id: session.user.id, display_name: accountName || session.user.user_metadata?.full_name || session.user.email, last_seen: new Date().toISOString() }, { onConflict: 'id' })
      if (res?.error) {
        console.error('upsertPresence error', res.error)
        if (res.error.code === 'PGRST205' || /Could not find the table/i.test(res.error.message || '')) {
          console.warn('user_presence table not found; disabling presence feature')
          presenceEnabledRef.current = false
          await stopPresence()
          if (!presenceProbeIntervalRef.current) {
            probePresence()
            presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
          }
        }
      }
    } catch (err: any) {
      console.error('upsertPresence exception', err)
      if (/Could not find the table/i.test(err?.message || '')) {
        console.warn('user_presence table not found (exception); disabling presence feature')
        presenceEnabledRef.current = false
        await stopPresence()
        if (!presenceProbeIntervalRef.current) {
          probePresence()
          presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
        }
      }
    }
  }

  const removePresence = async () => {
    if (!presenceEnabledRef.current) return
    try {
      const res = await (supabase as any).from('user_presence').delete().eq('id', session.user.id)
      if (res?.error) {
        console.error('removePresence error', res.error)
        if (res.error.code === 'PGRST205' || /Could not find the table/i.test(res.error.message || '')) {
          console.warn('user_presence table not found; disabling presence feature')
          presenceEnabledRef.current = false
          await stopPresence()
          // テーブルが見つかるか定期的にプローブして自動で再有効化する
          if (!presenceProbeIntervalRef.current) {
            probePresence()
            presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
          }
        }
      }
    } catch (err: any) {
      console.error('removePresence exception', err)
      if (/Could not find the table/i.test(err?.message || '')) {
        console.warn('user_presence table not found (exception); disabling presence feature')
        presenceEnabledRef.current = false
        await stopPresence()
        if (!presenceProbeIntervalRef.current) {
          probePresence()
          presenceProbeIntervalRef.current = window.setInterval(probePresence, 30_000)
        }
      }
    }
  }

  // テーブルが無い状態で無効化されたとき、定期的に存在確認を行い見つかれば自動で presence を再開する
  const probePresence = async () => {
    try {
      const res = await (supabase as any).from('user_presence').select('id').limit(1)
      if (!res.error) {
        console.info('user_presence table is available; enabling presence')
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
    if (!presenceEnabledRef.current) {
      console.warn('presence feature disabled; not starting presence')
      return
    }

    if (presenceProbeIntervalRef.current) {
      clearInterval(presenceProbeIntervalRef.current)
      presenceProbeIntervalRef.current = null
    }

    upsertPresence()
    fetchOnlineUsers()
    
    // 定期的に upsert と fetch を行う（自分の presence 更新 + TTL ベースでオフラインユーザーを除外）
    presenceIntervalRef.current = window.setInterval(() => {
      upsertPresence()
      fetchOnlineUsers() // ログアウト/非アクティブユーザーを TTL で除外
    }, 25_000)

    try {
      // Realtime で INSERT/UPDATE/DELETE を監視してリアルタイムに反映
      presenceChannelRef.current = (supabase as any).channel('presence')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => {
          fetchOnlineUsers()
        })
        .subscribe()
    } catch (e) {
      console.warn('presence channel setup failed', e)
    }
  }

  const stopPresence = async () => {
    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current)
      presenceIntervalRef.current = null
    }
    if (presenceChannelRef.current) {
      try { (supabase as any).removeChannel?.(presenceChannelRef.current) } catch {}
      presenceChannelRef.current = null
    }
    if (presenceProbeIntervalRef.current) {
      clearInterval(presenceProbeIntervalRef.current)
      presenceProbeIntervalRef.current = null
    }
    await removePresence()
  }

  const toast = useToast()

  // 案件一覧を取得
  const fetchProjects = async () => {
    try {
      const res = await (supabase as any)
        .from('project')
        .select('id, created_at, created_user, project_name, project_status, client_id, project_outline, project_url, project_manhour, project_budget, project_result, project_deadline, project_delivery')
        .order('created_at', { ascending: false })

      if (res.error) {
        console.error('fetchProjects error', res.error)
        setProjects([])
        return
      }

      setProjects(res.data ?? [])
      // 集計画面をリロード
      setReportRefreshKey(prev => prev + 1)
    } catch (err) {
      console.error('fetchProjects exception', err)
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
        console.error('fetchClientsForSelect error', res.error)
        setClientsForSelect([])
        return
      }
      setClientsForSelect(res.data ?? [])
    } catch (err) {
      console.error('fetchClientsForSelect exception', err)
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
        console.error('fetchUserType error', res.error)
        setUserType(null)
        return
      }
      setUserType(res.data?.user_type ?? null)
    } catch (err) {
      console.error('fetchUserType exception', err)
      setUserType(null)
    }
  }

  useEffect(() => {
    fetchProjects()
    fetchClientsForSelect()
    fetchUserType()

    // presence を開始（マウント時）
    startPresence()

    // ブラウザを閉じる際に presence を削除
    const beforeUnload = () => {
      removePresence()
    }
    window.addEventListener('beforeunload', beforeUnload)

    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      // クリーンアップ
      stopPresence()
    }
  }, [])


  // Client registration moved to `ClientForm` component

  const handleLogout = async () => {
    // サインアウト前に presence を停止・削除
    await stopPresence()
    await supabase.auth.signOut()
  }

  const openAccountModal = () => {
    setAccountName(session.user.user_metadata?.full_name ?? '')
    setIsAccountOpen(true)
  }

  const closeAccountModal = () => {
    setIsAccountOpen(false)
  }

  const saveAccount = async () => {
    try {
      setAccountLoading(true)
      // Update auth user metadata
      const updates: any = { data: { full_name: accountName } }
      const res = await (supabase as any).auth.updateUser(updates)
      if (res.error) {
        toast(`更新に失敗しました: ${res.error.message}`,'error')
        return
      }

      // Update profiles table with display_name
      const profileRes = await (supabase as any)
        .from('profiles')
        .upsert({ id: session.user.id, display_name: accountName }, { onConflict: 'id' })
        .select()

      if (profileRes.error) {
        console.error('Profile update error:', profileRes.error)
        toast('プロファイルの更新に失敗しました','error')
        return
      }

      toast('アカウント情報を更新しました','success')
      // 表示名更新を presence に反映
      await upsertPresence()
      closeAccountModal()
    } catch (err) {
      console.error('saveAccount exception', err)
      toast('更新中にエラーが発生しました','error')
    } finally {
      setAccountLoading(false)
    }
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-8">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">工数管理システム</h1>
              <p className="text-muted-foreground mt-1">
                ログイン中：<span className="font-medium text-primary">{accountName || session.user.user_metadata?.full_name || session.user.email}</span>
                {onlineUsers.filter(u => u.id !== session.user.id).length > 0 && (
                  <span className="ml-3 text-sm text-muted-foreground">他オンライン: <span className="font-medium text-primary">{onlineUsers.filter(u => u.id !== session.user.id).map(u => u.display_name || u.id).join(', ')}</span></span>
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
                onClick={openAccountModal}
              >
                アカウント
              </Button>
              <Button onClick={handleLogout} className="text-red-500 font-semibold" variant="ghost">ログアウト</Button>
            </div>
          </div>
          
          {isAccountOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={closeAccountModal} />
              <div className="bg-card border border-border rounded-lg shadow-lg p-6 z-10 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">アカウント情報の編集</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">メール</label>
                    <input readOnly value={session.user.email} className="w-full px-3 py-2 border rounded bg-muted text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">表示名</label>
                    <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full px-3 py-2 border rounded" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button onClick={saveAccount} disabled={accountLoading}>{accountLoading ? '保存中...' : '保存'}</Button>
                  <Button variant="outline" onClick={closeAccountModal}>キャンセル</Button>
                </div>
              </div>
            </div>
          )}
          <div className="bg-card border border-border rounded-lg shadow-md p-6">
            {/* メニュー */}
            <div className="flex gap-2 mb-6">
              <Button onClick={() => setView('report')} variant={view === 'report' ? 'default' : 'ghost'}>集計</Button>
              <Button onClick={() => setView('list')} variant={view === 'list' ? 'default' : 'ghost'}>案件管理</Button>
              <Button onClick={() => setView('client')} variant={view === 'client' ? 'default' : 'ghost'}>クライアント管理</Button>
            </div>

            {/* コンテンツ */}
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
    </>
  )
}

export default App