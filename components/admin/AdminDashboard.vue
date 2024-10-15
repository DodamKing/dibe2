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
                <h3 class="text-lg font-semibold mb-2">방문자 통계 (최근 7일)</h3>
                <p>총 페이지뷰: {{ visitorStats.totalPageviews }}</p>
                <p>고유 방문자 수: {{ visitorStats.uniqueVisitors }}</p>
                <p>로그인한 방문 수: {{ visitorStats.loggedInVisits }}</p>
                <p>고유 로그인 사용자 수: {{ visitorStats.uniqueLoggedInVisitors }}</p>
                <BarChart :chart-data="visitorChartData" :options="chartOptions" />
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
            }
        },
        BarChart: {
            extends: Bar,
            props: ['chartData', 'options'],
            mounted() {
                this.renderChart(this.chartData, this.options)
            }
        }
    },
    data() {
        return {
            userStats: {},
            visitorStats: {},
            visitorChartData: null,
            musicStats: {},
            supportStats: {},
            systemStats: {},
            isLoading: true,
            error: null,
            userChartData: null,
            lastUpdated: '로딩 중...',
            chartOptions: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 0,
                        ticks: {
                            stepSize: 1,
                            callback: function (value) {
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
        }
    },
    async fetch() {
        try {
            // 사용자 통계 API 호출
            const [userStatsResponse, visitorStatsResponse] = await Promise.all([
                this.$axios.get('/api/admin/user-stats'),
                this.$axios.get('/api/admin/visitor-stats'),
            ])

            this.userStats = userStatsResponse.data
            this.visitorStats = visitorStatsResponse.data

            await this.refreshSystemStats()

            this.prepareUserChartData()
            this.prepareVisitorChartData()

            // 나머지 통계는 더미 데이터 사용
            this.musicStats = this.getDummyMusicStats()
            this.supportStats = this.getDummySupportStats()
        } catch (error) {
            console.error('Error fetching dashboard data:', error)
            this.error = error.message
        } finally {
            this.isLoading = false
        }
    },
    methods: {
        prepareUserChartData() {
            this.userChartData = {
                labels: ['6일 전', '5일 전', '4일 전', '3일 전', '2일 전', '어제', '오늘'],
                datasets: [{
                    label: '일일 신규 사용자',
                    data: this.userStats.newUsersLastWeek?.map(Math.round) || [0, 0, 0, 0, 0, 0, 0],
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            }
        },
        prepareVisitorChartData() {
            this.visitorChartData = {
                labels: ['방문자 통계'],
                datasets: [
                    {
                        label: '총 페이지뷰',
                        data: [this.visitorStats.totalPageviews],
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '고유 방문자',
                        data: [this.visitorStats.uniqueVisitors],
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '로그인 방문',
                        data: [this.visitorStats.loggedInVisits],
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '고유 로그인 사용자',
                        data: [this.visitorStats.uniqueLoggedInVisitors],
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
                // 에러 처리 (예: 사용자에게 알림)
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
        getDummySystemStats() {
            return {
                uptime: '7일 3시간',
                cpuUsage: 45,
                memoryUsage: 60
            }
        },
    },
}
</script>