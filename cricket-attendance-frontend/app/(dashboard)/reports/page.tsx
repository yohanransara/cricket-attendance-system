'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { FileDown, TrendingUp, Users, Calendar as CalendarIcon, Award, Loader2, Search, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { attendanceAPI, reportAPI } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { MonthlyAttendanceData, DashboardStats, SessionAttendance, StudentAttendanceRecord } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [monthlyData, setMonthlyData] = useState<MonthlyAttendanceData[]>([]);

    // Daily Report State
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [dailyReport, setDailyReport] = useState<SessionAttendance | null>(null);
    const [fetchingDaily, setFetchingDaily] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [statsData, monthly] = await Promise.all([
                reportAPI.getDashboardStats(),
                reportAPI.getMonthlyData(new Date().getFullYear(), new Date().getMonth() + 1)
            ]);
            setStats(statsData);
            setMonthlyData(monthly);
        } catch (error) {
            console.error('Failed to load reports:', error);
            toast.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    const handleDateSelect = async (date: Date | undefined) => {
        setSelectedDate(date);
        if (!date) {
            setDailyReport(null);
            return;
        }

        setFetchingDaily(true);
        try {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const data = await attendanceAPI.getSessionByDate(formattedDate);
            if (data) {
                setDailyReport(data);
                toast.success(`Loaded attendance for ${formattedDate}`);
            } else {
                setDailyReport(null);
                toast.info(`No practice session found for ${formattedDate}`);
            }
        } catch (error) {
            console.error('Failed to fetch daily report:', error);
            toast.error('Failed to load daily attendance');
        } finally {
            setFetchingDaily(false);
        }
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF();
            const isDaily = !!dailyReport && !!selectedDate;
            const title = isDaily
                ? `Attendance Report - ${format(selectedDate!, 'PPP')}`
                : 'RUSL Cricket Monthly Attendance Report';

            // Custom Branding
            doc.setFillColor(10, 31, 68);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text("CRICKET ATTENDANCE MANAGEMENT", 105, 15, { align: 'center' });
            
            doc.setFontSize(14);
            doc.text(title, 105, 25, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 45);

            let head, body;

            if (isDaily) {
                head = [['Reg ID', 'Student Name', 'Status']];
                body = dailyReport!.attendance.map((record: StudentAttendanceRecord) => [
                    record.studentRegId,
                    record.studentName,
                    record.isPresent ? 'PRESENT' : 'ABSENT'
                ]);
            } else {
                if (stats?.topAttendee?.name) {
                    doc.setFontSize(11);
                    doc.setTextColor(10, 31, 68);
                    doc.text(`Top Attendee: ${stats.topAttendee.name} (${stats.topAttendee.attendancePercentage.toFixed(1)}%)`, 14, 52);
                }
                head = [['Month', 'Present Count', 'Absent Count']];
                body = monthlyData.map((item: MonthlyAttendanceData) => [
                    item.month,
                    item.present.toString(),
                    item.absent.toString()
                ]);
            }

            autoTable(doc, {
                startY: isDaily ? 55 : 60,
                head: head,
                body: body,
                headStyles: { fillColor: [10, 31, 68], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                styles: { fontSize: 10, cellPadding: 4 },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 2 && isDaily) {
                        const cell = data.cell.text[0];
                        if (cell === 'PRESENT') {
                            doc.setTextColor(0, 128, 0);
                        } else {
                            doc.setTextColor(255, 0, 0);
                        }
                    }
                }
            });

            const filename = isDaily
                ? `cricket_attendance_${format(selectedDate!, 'yyyy_MM_dd')}.pdf`
                : 'cricket_monthly_summary.pdf';

            doc.save(filename);
            toast.success('PDF report downloaded');
        } catch (error) {
            console.error('PDF export failed:', error);
            toast.error('Failed to generate PDF');
        }
    };

    const handleExportExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const isDaily = !!dailyReport && !!selectedDate;
            const sheetName = isDaily ? 'Daily Attendance' : 'Monthly Summary';
            const worksheet = workbook.addWorksheet(sheetName);

            if (isDaily) {
                worksheet.columns = [
                    { header: 'Reg ID', key: 'studentRegId', width: 20 },
                    { header: 'Student Name', key: 'studentName', width: 30 },
                    { header: 'Status', key: 'status', width: 15 }
                ];
                dailyReport!.attendance.forEach((record: StudentAttendanceRecord) => {
                    worksheet.addRow({
                        studentRegId: record.studentRegId,
                        studentName: record.studentName,
                        status: record.isPresent ? 'Present' : 'Absent'
                    });
                });
            } else {
                worksheet.columns = [
                    { header: 'Month', key: 'month', width: 20 },
                    { header: 'Present', key: 'present', width: 15 },
                    { header: 'Absent', key: 'absent', width: 15 }
                ];
                monthlyData.forEach((item: MonthlyAttendanceData) => {
                    worksheet.addRow(item);
                });
            }

            // Stylize Header
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF0A1F44' }
            };

            const filename = isDaily
                ? `cricket_attendance_${format(selectedDate!, 'yyyy_MM_dd')}.xlsx`
                : 'cricket_monthly_summary.xlsx';

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, filename);
            toast.success('Excel export downloaded');
        } catch (error) {
            console.error('Excel export failed:', error);
            toast.error('Failed to generate Excel file');
        }
    };

    const COLORS = ['#0A1F44', '#F5B301', '#E2E8F0'];

    const pieData = stats ? [
        { name: 'Average Attendance', value: stats.averageAttendance },
        { name: 'Absence Rate', value: 100 - stats.averageAttendance }
    ] : [];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh]">
                <div className="relative">
                    <TrendingUp className="w-16 h-16 text-primary animate-pulse opacity-20" />
                    <Loader2 className="w-16 h-16 text-primary animate-spin absolute top-0 left-0" />
                </div>
                <p className="text-muted-foreground text-lg mt-6 font-semibold">Gathering performance metrics...</p>
            </div>
        );
    }

    return (
        <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-8 pb-12"
        >
            <motion.div 
                variants={item}
                className="flex flex-col md:flex-row md:items-center justify-between bg-white p-8 rounded-3xl border-none shadow-2xl relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110 opacity-70"></div>
                
                <div className="relative z-10">
                    <h1 className="text-4xl font-black text-[#0A1F44] tracking-tight mb-2">Advanced <span className="text-accent underline decoration-4 underline-offset-8">Reports</span></h1>
                    <p className="text-lg text-muted-foreground font-medium">Crunching participation data for squad selection</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 relative z-10 mt-6 md:mt-0">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={`w-[260px] h-14 justify-start text-left font-bold border-2 rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all ${!selectedDate && "text-muted-foreground"}`}>
                                <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                {selectedDate ? format(selectedDate, "PPP") : <span>Filter by practice date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden shadow-2xl" align="end">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={handleDateSelect}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>

                    <div className="flex gap-2 w-full md:w-auto">
                        <Button
                            className="flex-1 md:flex-none bg-[#0A1F44] hover:bg-[#1a2e5a] text-white h-14 px-8 rounded-2xl font-bold shadow-xl hover:shadow-2xl hover:translate-y-[-2px] transition-all flex items-center gap-2"
                            onClick={handleExportPDF}
                            disabled={!monthlyData.length && !dailyReport}
                        >
                            <FileDown className="w-5 h-5" /> Export PDF
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 md:flex-none border-2 text-[#F5B301] border-[#F5B301] hover:bg-[#F5B301]/10 h-14 px-8 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:translate-y-[-2px] transition-all flex items-center gap-2"
                            onClick={handleExportExcel}
                            disabled={!monthlyData.length && !dailyReport}
                        >
                            <FileDown className="w-5 h-5" /> Excel
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* Summary Grid */}
            <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ReportStatCard title="Total Practices" value={stats?.totalPracticeDays || 0} icon={CalendarIcon} color="text-primary" bgColor="bg-primary/5" iconBg="bg-white" />
                <ReportStatCard title="Active Players" value={stats?.totalPlayers || 0} icon={Users} color="text-accent" bgColor="bg-accent/5" iconBg="bg-white" />
                <ReportStatCard title="Avg. Attendance" value={`${stats?.averageAttendance.toFixed(1)}%`} icon={TrendingUp} color="text-green-600" bgColor="bg-green-50" iconBg="bg-white" />
                <ReportStatCard title="Squad MVP" value={stats?.topAttendee?.name || 'N/A'} subtitle={`${stats?.topAttendee?.attendancePercentage.toFixed(1)}% attendance`} icon={Award} color="text-amber-600" bgColor="bg-amber-50" iconBg="bg-white" />
            </motion.div>

            <AnimatePresence mode="wait">
                {selectedDate && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 30 }}
                        transition={{ type: "spring", damping: 20 }}
                    >
                        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
                            <CardHeader className="bg-[#0A1F44] text-white p-10 relative overflow-hidden">
                                <div className="absolute inset-0 bg-blue-400/5 -skew-y-6 translate-y-20"></div>
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <CardTitle className="text-3xl font-black mb-1">
                                            {format(selectedDate, 'MMMM d, yyyy')}
                                        </CardTitle>
                                        <CardDescription className="text-blue-100/70 text-lg font-medium">Session participation breakdown</CardDescription>
                                    </div>
                                    {dailyReport && (
                                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-3 ring-1 ring-white/20">
                                            <div className="w-3 h-3 bg-accent rounded-full animate-pulse shadow-[0_0_15px_rgba(245,179,1,0.5)]"></div>
                                            <span className="font-bold tracking-tight text-xl">{dailyReport.attendance.filter(a => a.isPresent).length} IN DUGOUT</span>
                                        </div>
                                    )}
                                </div>
                                {fetchingDaily && <Loader2 className="w-8 h-8 animate-spin absolute top-10 right-10 text-accent/50" />}
                            </CardHeader>
                            <CardContent className="p-0">
                                {dailyReport ? (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50 border-none hover:bg-slate-50">
                                                    <TableHead className="px-10 py-6 text-sm font-black text-slate-400 uppercase tracking-widest">Registration ID</TableHead>
                                                    <TableHead className="px-10 py-6 text-sm font-black text-slate-400 uppercase tracking-widest">Player Name</TableHead>
                                                    <TableHead className="px-10 py-6 text-sm font-black text-slate-400 uppercase tracking-widest text-center">Participation</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dailyReport.attendance.map((record: StudentAttendanceRecord) => (
                                                    <TableRow key={record.studentId} className="border-slate-50 hover:bg-slate-50/70 transition-colors group">
                                                        <TableCell className="px-10 py-6 font-black text-[#0A1F44]">{record.studentRegId}</TableCell>
                                                        <TableCell className="px-10 py-6 font-extrabold text-slate-700 text-lg">{record.studentName}</TableCell>
                                                        <TableCell className="px-10 py-6">
                                                            <div className="flex justify-center">
                                                                {record.isPresent ? (
                                                                    <div className="flex items-center gap-3 bg-green-50 text-green-700 font-black px-6 py-2 rounded-2xl ring-2 ring-green-100 shadow-sm border border-green-200">
                                                                        <CheckCircle className="w-5 h-5" /> PRESENT
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-3 bg-slate-100 text-slate-400 font-black px-6 py-2 rounded-2xl grayscale transition-all group-hover:grayscale-0">
                                                                        <XCircle className="w-5 h-5" /> ABSENT
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                                        <Search className="w-24 h-24 mb-6 opacity-10" />
                                        <p className="text-2xl font-black italic">Ghost Practice Day</p>
                                        <p className="font-medium text-slate-400">No session logs found for this specific date.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Monthly Chart */}
                <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white group">
                    <CardHeader className="p-10 pb-4">
                        <CardTitle className="text-2xl font-black flex items-center gap-3"><TrendingUp className="text-primary" /> Monthly participation</CardTitle>
                        <CardDescription className="font-semibold">Season trend visualization</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] p-8 pt-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 800, fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 800, fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 800 }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 800 }} />
                                <Bar dataKey="present" name="Present" fill="#0A1F44" radius={[12, 12, 0, 0]} barSize={24} />
                                <Bar dataKey="absent" name="Absent" fill="#F5B301" radius={[12, 12, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Pie Chart */}
                <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white text-center">
                    <CardHeader className="p-10 pb-4 text-left">
                        <CardTitle className="text-2xl font-black flex items-center gap-3"><Award className="text-accent" /> Engagement Score</CardTitle>
                        <CardDescription className="font-semibold">Overall season participation</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] flex items-center justify-center p-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={90}
                                    outerRadius={140}
                                    paddingAngle={10}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 800 }}
                                />
                                <Legend wrapperStyle={{ fontWeight: 800 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-[52%] left-[50%] translate-x-[-50%] translate-y-[-50%] text-center">
                            <span className="block text-4xl font-black text-[#0A1F44]">{stats?.averageAttendance.toFixed(0)}%</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Presence</span>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}

function ReportStatCard({ title, value, icon: Icon, color, bgColor, iconBg, subtitle }: any) {
    return (
        <motion.div whileHover={{ y: -8 }}>
            <Card className={`border-none ${bgColor} shadow-lg rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl h-full`}>
                <CardHeader className="pb-2">
                    <div className={`${iconBg} w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm mb-4`}>
                        <Icon className={`w-7 h-7 ${color}`} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black text-[#0A1F44] mb-1">{value}</div>
                    <div className="text-sm font-black text-slate-400 uppercase tracking-widest">{title}</div>
                    {subtitle && <p className="text-[10px] font-black text-slate-500/60 mt-2 uppercase tracking-tight">{subtitle}</p>}
                </CardContent>
            </Card>
        </motion.div>
    );
}
