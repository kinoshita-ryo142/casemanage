import { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type ChartData = {
  month: string
  planned: number
  actual: number
}

type Statistics = {
  thisMonthPlanned: number
  thisMonthActual: number
  thisYearPlanned: number
  thisYearActual: number
}

export default function ReportView() {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [stats, setStats] = useState<Statistics>({ thisMonthPlanned: 0, thisMonthActual: 0, thisYearPlanned: 0, thisYearActual: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReportData()
  }, [])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const res = await (supabase as any)
        .from('project')
        .select('project_budget, project_result, project_deadline, project_delivery, project_status')
        .not('project_budget', 'is', null)

      if (res.error) {
        console.error('fetchReportData error', res.error)
        return
      }

      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonth = today.getMonth() + 1
      const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

      // 月ごとに集計
      const monthlyData: { [key: string]: { planned: number; actual: number } } = {}
      let thisMonthPlanned = 0
      let thisMonthActual = 0
      let thisYearPlanned = 0
      let thisYearActual = 0

      res.data.forEach((project: any) => {
        const budget = Number(project.project_budget) || 0
        const result = Number(project.project_result) || 0
        const status = Number(project.project_status)
        const deadline = project.project_deadline
        const delivery = project.project_delivery

        if (!deadline && !delivery) return

        // グラフ用の月別集計（納品日または納品予定日を使用）
        const targetDate = delivery || deadline
        if (targetDate) {
          const date = new Date(targetDate)
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const monthKey = `${year}年${month}月`

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { planned: 0, actual: 0 }
          }

          if (status >= 1 && status <= 3) {
            monthlyData[monthKey].planned += budget
          } else if (status === 4) {
            monthlyData[monthKey].actual += result
          }
        }

        // 統計情報の計算
        // 今月納品予定：project_statusが1～3で、今月納品予定(project_deadline)の案件
        if (status >= 1 && status <= 3 && deadline) {
          const deadlineDate = new Date(deadline)
          const deadlineYear = deadlineDate.getFullYear()
          const deadlineMonth = deadlineDate.getMonth() + 1
          const deadlineMonthKey = `${deadlineYear}-${String(deadlineMonth).padStart(2, '0')}`
          if (deadlineMonthKey === currentMonthKey) {
            thisMonthPlanned += budget
          }
        }

        // 今月実績：project_statusが4で、今月納品(project_deadline)の案件
        if (status === 4 && deadline) {
          const deadlineDate = new Date(deadline)
          const deadlineYear = deadlineDate.getFullYear()
          const deadlineMonth = deadlineDate.getMonth() + 1
          const deadlineMonthKey = `${deadlineYear}-${String(deadlineMonth).padStart(2, '0')}`
          if (deadlineMonthKey === currentMonthKey) {
            thisMonthActual += result
          }
        }

        // 今年度予算：project_statusが1～3で、今年納品予定の案件
        if (status >= 1 && status <= 3 && deadline) {
          const deadlineDate = new Date(deadline)
          if (deadlineDate.getFullYear() === currentYear) {
            thisYearPlanned += budget
          }
        }

        // 今年度実績：project_statusが4で、今年納品の案件
        if (status === 4 && (delivery || deadline)) {
          const targetDeliveryDate = new Date(delivery || deadline)
          const targetYear = targetDeliveryDate.getFullYear()
          if (targetYear === currentYear) {
            thisYearActual += result
          }
        }
      })

      // キーをソートして配列に変換
      const sortedData = Object.entries(monthlyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, values]) => ({
          month,
          planned: values.planned,
          actual: values.actual,
        }))

      setChartData(sortedData)
      setStats({ thisMonthPlanned, thisMonthActual, thisYearPlanned, thisYearActual })
    } catch (err) {
      console.error('fetchReportData exception', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-foreground mb-6">集計</h2>
      
      {/* 統計情報カード */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground mb-2">今月予算</div>
          <div className="text-2xl font-bold text-foreground">
            ¥{stats.thisMonthPlanned.toLocaleString()}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground mb-2">今月実績</div>
          <div className="text-2xl font-bold text-foreground">
            ¥{stats.thisMonthActual.toLocaleString()}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground mb-2">今年度予算</div>
          <div className="text-2xl font-bold text-foreground">
            ¥{stats.thisYearPlanned.toLocaleString()}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground mb-2">今年度実績</div>
          <div className="text-2xl font-bold text-foreground">
            ¥{stats.thisYearActual.toLocaleString()}
          </div>
        </div>
      </div>

      {/* チャート */}
      {loading ? (
        <div className="text-muted-foreground">データを読み込み中...</div>
      ) : chartData.length === 0 ? (
        <div className="text-muted-foreground">表示するデータがありません</div>
      ) : (
        <div className="w-full h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip
                formatter={(value) => value.toLocaleString()}
                labelFormatter={(label) => `${label}`}
              />
              <Legend />
              <Bar dataKey="planned" fill="#3b82f6" name="予算" />
              <Bar dataKey="actual" fill="#10b981" name="実績" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
