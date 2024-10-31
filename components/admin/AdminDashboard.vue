<template>
    <div>
        <h2 class="text-2xl font-semibold text-gray-900 mb-4">대시보드</h2>
        <div v-if="isLoading">로딩 중...</div>
        <div v-else-if="error">에러 발생: {{ error }}</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- 사용자 통계 -->
            <div class="bg-white shadow rounded-lg p-6">
                <h3 class="text-lg font-semibold mb-2">사용자 통계</h3>
                <p>총 사용자 수: {{ userStats.totalUsers }}</p>
                <p>신규 사용자 (오늘): {{ userStats.newUsersToday }}</p>
                <LineChart :chart-data="userChartData" :options="chartOptions" />
            </div>

            <!-- 방문자 통계 -->
            <div class="bg-white shadow rounded-lg p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">방문자 통계</h3>
                    <div class="flex items-center">
                        <select v-model="selectedVisitorPeriod" @change="prepareVisitorChartData" class="mr-2 p-2 border rounded">
                            <option value="today">오늘</option>
                            <option value="week">최근 7일</option>
                        </select>
                        <button @click="refreshVisitorStats" class="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-300 ease-in-out">
                            새로고침
                        </button>
                    </div>
                </div>
                <div v-if="visitorStatsLoading" class="text-center py-4">
                    <p>로딩 중...</p>
                </div>
                <div v-else>
                    <template v-if="selectedVisitorPeriod === 'today'">
                        <p>총 페이지뷰: {{ todayStats.totalPageviews }}</p>
                        <p>고유 방문자 수: {{ todayStats.uniqueVisitors }}</p>
                        <p>로그인한 방문 수: {{ todayStats.loggedInVisits }}</p>
                        <p>고유 로그인 사용자 수: {{ todayStats.uniqueLoggedInVisitors }}</p>
                    </template>
                    <template v-else>
                        <p>총 페이지뷰: {{ weeklyStats.totalPageviews }}</p>
                        <p>고유 방문자 수: {{ weeklyStats.uniqueVisitors }}</p>
                        <p>로그인한 방문 수: {{ weeklyStats.loggedInVisits }}</p>
                        <p>고유 로그인 사용자 수: {{ weeklyStats.uniqueLoggedInVisitors }}</p>
                    </template>
                    <BarChart :chart-data="visitorChartData" :options="chartOptions" />
                </div>
            </div>

            <!-- 음원 통계 -->
            <div class="bg-white shadow rounded-lg p-6">
                <h3 class="text-lg font-semibold mb-2">음원 통계</h3>
                <p>총 음원 수: {{ musicStats.totalTracks }}</p>
                <p>오늘의 스트리밍 횟수: {{ musicStats.todayStreams }}</p>
            </div>

            <!-- 문의사항 -->
            <div class="bg-white shadow rounded-lg p-6">
                <h3 class="text-lg font-semibold mb-2">문의사항</h3>
                <p>대기 중인 문의: {{ supportStats.pendingInquiries }}</p>
                <p>오늘 해결된 문의: {{ supportStats.resolvedToday }}</p>
            </div>

            <!-- 시스템 상태 -->
            <div class="bg-white shadow rounded-lg p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-800">시스템 상태</h3>
                    <button @click="refreshSystemStats"
                        class="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-300 ease-in-out">
                        새로고침
                    </button>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="bg-blue-100 p-4 rounded-lg">
                        <p class="text-sm text-blue-800 font-medium">서버 운영 시간</p>
                        <p class="text-lg font-bold text-blue-900">{{ systemStats.uptime }}</p>
                    </div>
                    <div class="bg-green-100 p-4 rounded-lg">
                        <p class="text-sm text-green-800 font-medium">CPU 사용률</p>
                        <p class="text-lg font-bold text-green-900">{{ systemStats.cpuUsage }}%</p>
                    </div>
                    <div class="bg-yellow-100 p-4 rounded-lg">
                        <p class="text-sm text-yellow-800 font-medium">메모리 사용률</p>
                        <p class="text-lg font-bold text-yellow-900">{{ systemStats.memoryUsage }}%</p>
                    </div>
                    <div class="bg-red-100 p-4 rounded-lg">
                        <p class="text-sm text-red-800 font-medium">디스크 사용률</p>
                        <p class="text-lg font-bold text-red-900">{{ systemStats.diskUsage }}%</p>
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-sm text-gray-600">마지막 업데이트: {{ lastUpdated }}</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Line, Bar } from 'vue-chartjs'

export default {
    components: {
        LineChart: {
            extends: Line,
            props: ['chartData', 'options'],
            mounted() {
                this.renderChart(this.chartData, this.options)
            },
            watch: {
                chartData: {
                    handler() {
                        this.renderChart(this.chartData, this.options)
                    },
                    deep: true
                }
            }
        },
        BarChart: {
            extends: Bar,
            props: ['chartData', 'options'],
            mounted() {
                this.renderChart(this.chartData, this.options)
            },
            watch: {
                chartData: {
                    handler() {
                        this.renderChart(this.chartData, this.options)
                    },
                    deep: true
                }
            }
        }
    },
    data() {
        return {
            userStats: {},
            visitorStats: [],
            visitorChartData: null,
            musicStats: {},
            supportStats: {},
            systemStats: {},
            isLoading: true,
            visitorStatsLoading: false,
            error: null,
            userChartData: null,
            lastUpdated: '로딩 중...',
            selectedVisitorPeriod: 'today',
            chartOptions: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            callback(value) {
                                if (Math.floor(value) === value) {
                                    return value;
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    computed: {
        todayStats() {
            return this.visitorStats[this.visitorStats.length - 1] || {
                totalPageviews: 0,
                uniqueVisitors: 0,
                loggedInVisits: 0,
                uniqueLoggedInVisitors: 0
            }
        },
        weeklyStats() {
            return {
                totalPageviews: this.visitorStats.reduce((sum, day) => sum + day.totalPageviews, 0),
                uniqueVisitors: this.visitorStats.reduce((sum, day) => sum + day.uniqueVisitors, 0),
                loggedInVisits: this.visitorStats.reduce((sum, day) => sum + day.loggedInVisits, 0),
                uniqueLoggedInVisitors: this.visitorStats.reduce((sum, day) => sum + day.uniqueLoggedInVisitors, 0)
            }
        }
    },
    async mounted() {
        await this.fetchDashboardData()
    },
    methods: {
        async fetchDashboardData() {
            try {
                const [userStatsResponse, visitorStatsResponse] = await Promise.all([
                    this.$axios.$get('/api/admin/user-stats'),
                    this.$axios.$get('/api/admin/visitor-stats'),
                ])

                this.userStats = userStatsResponse
                this.visitorStats = visitorStatsResponse

                await this.refreshSystemStats()

                this.prepareUserChartData()
                this.prepareVisitorChartData()

                this.musicStats = this.getDummyMusicStats()
                this.supportStats = this.getDummySupportStats()
            } catch (error) {
                console.error('Error fetching dashboard data:', error)
                this.error = error.message
            } finally {
                this.isLoading = false
            }
        },
        prepareUserChartData() {
            if (!this.userStats?.dates) {
                // 서버에서 날짜 정보가 오지 않은 경우의 폴백
                this.userChartData = {
                    labels: ['6일 전', '5일 전', '4일 전', '3일 전', '2일 전', '어제', '오늘'],
                    datasets: [{
                        label: '일일 신규 사용자',
                        data: this.userStats.newUsersLastWeek || new Array(7).fill(0),
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                }
                return
            }

            // 서버에서 받은 날짜를 기반으로 레이블 생성
            const labels = this.userStats.dates.map(date => {
                const d = new Date(date)
                return new Intl.DateTimeFormat('ko-KR', { 
                    month: 'numeric', 
                    day: 'numeric',
                    weekday: 'short'
                }).format(d)
            })

            this.userChartData = {
                labels,
                datasets: [{
                    label: '일일 신규 사용자',
                    data: this.userStats.newUsersLastWeek,
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            }
        },
        prepareVisitorChartData() {
            const data = this.selectedVisitorPeriod === 'today' ? [this.todayStats] : this.visitorStats
            const labels = this.selectedVisitorPeriod === 'today' 
                ? ['오늘'] 
                : data.map(day => {
                    const date = new Date(day.date);
                    return date.toLocaleDateString('ko-KR', { weekday: 'short' });
                  })

            this.visitorChartData = {
                labels,
                datasets: [
                    {
                        label: '총 페이지뷰',
                        data: data.map(day => day.totalPageviews),
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '고유 방문자',
                        data: data.map(day => day.uniqueVisitors),
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '로그인 방문',
                        data: data.map(day => day.loggedInVisits),
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '고유 로그인 사용자',
                        data: data.map(day => day.uniqueLoggedInVisitors),
                        backgroundColor: 'rgba(255, 206, 86, 0.2)',
                        borderColor: 'rgba(255, 206, 86, 1)',
                        borderWidth: 1
                    }
                ]
            }
        },
        async refreshSystemStats() {
            try {
                const response = await this.$axios.get('/api/admin/system-stats')
                this.systemStats = response.data
                this.lastUpdated = new Date().toLocaleString()
            } catch (error) {
                console.error('Error fetching system stats:', error)
            }
        },
        async refreshVisitorStats() {
            try {
                this.visitorStatsLoading = true
                const visitorStatsResponse = await this.$axios.$get('/api/admin/visitor-stats')
                this.visitorStats = visitorStatsResponse
                this.prepareVisitorChartData()
            } catch (error) {
                console.error('Error refreshing visitor stats:', error)
                this.error = error.message
            } finally {
                this.visitorStatsLoading = false
            }
        },
        getDummyMusicStats() {
            return {
                totalTracks: 50000,
                todayStreams: 100000
            }
        },
        getDummySupportStats() {
            return {
                pendingInquiries: 20,
                resolvedToday: 50
            }
        },
    },
}
</script>