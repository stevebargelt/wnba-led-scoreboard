import { Layout } from '../components/layout'
import { Card, CardHeader, CardTitle } from '../components/ui'
import { ChartBarIcon } from '@heroicons/react/24/outline'

export default function Analytics() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Device usage statistics and insights
          </p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Coming Soon
            </CardTitle>
          </CardHeader>

          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              Analytics features are coming soon. This page will display device uptime, usage
              statistics, and performance insights.
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
