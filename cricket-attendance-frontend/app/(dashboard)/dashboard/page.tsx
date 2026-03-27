'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Calendar, Users, TrendingUp, Trophy, Award, 
    Clock, Download, CheckCircle2, XCircle, ChevronRight
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { reportAPI, attendanceAPI } from '@/lib/api';
import type { DashboardStats, StudentStats, PracticeAttendance, User, AdminAttendanceSummary } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [adminStats, setAdminStats] = useState<DashboardStats | null>(null);
    const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
    const [recentAttendance, setRecentAttendance] = useState<PracticeAttendance[]>([]);
    const [detailedSummary, setDetailedSummary] = useState<AdminAttendanceSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser && storedUser !== 'undefined') {
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error('Failed to parse user session:', error);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        }
    }, []);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                if (user.role === 'STUDENT') {
                    const [stats, recent] = await Promise.all([
                        reportAPI.getPersonalStats(),
                        attendanceAPI.getRecentAttendance()
                    ]);
                    setStudentStats(stats);
                    setRecentAttendance(recent);
                } else {
                    const [stats, detailed, recent] = await Promise.all([
                        reportAPI.getDashboardStats(),
                        reportAPI.getDetailedAttendance(),
                        attendanceAPI.getRecentAttendance()
                    ]);
                    setAdminStats(stats);
                    setDetailedSummary(detailed);
                    setRecentAttendance(recent);
                }
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const handleExportPersonalPDF = async () => {
        if (!studentStats || !user) return;
        
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const doc = new jsPDF();
        
        // Custom Header with Logo-like design
        doc.setFillColor(10, 31, 68);
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text("CRICKET ATTENDANCE SYSTEM", 105, 18, { align: 'center' });
        
        doc.setFontSize(14);
        doc.text("Individual Performance Report", 105, 28, { align: 'center' });

        // Student Info Box
        doc.setFillColor(245, 179, 1);
        doc.rect(14, 45, 182, 35, 'F');
        
        doc.setFontSize(12);
        doc.setTextColor(10, 31, 68);
        doc.setFont("helvetica", "bold");
        doc.text(`Player Name: ${studentStats.studentName || 'Student'}`, 20, 55);
        doc.text(`Email: ${user.email}`, 20, 62);
        doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 20, 69);
        
        doc.text(`Attendance Rate: ${studentStats.attendancePercentage.toFixed(1)}%`, 140, 55);
        doc.text(`Sessions: ${studentStats.sessionsAttended} / ${studentStats.totalSessions}`, 140, 62);

        // Attendance Log Table
        autoTable(doc, {
            startY: 90,
            head: [['Date', 'Status']],
            body: studentStats.recentAttendance.map(a => [
                a.date,
                a.isPresent ? 'PRESENT' : 'ABSENT'
            ]),
            styles: { fontSize: 11, cellPadding: 5 },
            headStyles: { fillColor: [10, 31, 68], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            columnStyles: {
                1: { fontStyle: 'bold' }
            },
            didDrawCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 1) {
                    const text = data.cell.text[0];
                    if (text === 'PRESENT') {
                        doc.setTextColor(0, 128, 0);
                    } else {
                        doc.setTextColor(255, 0, 0);
                    }
                }
            }
        });

        const safeName = (studentStats.studentName || 'Student').replace(/\s+/g, '_');
        doc.save(`${safeName}_Report.pdf`);
    };

    const handleExportDetailedAdminPDF = async () => {
        if (!detailedSummary) return;
        
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const doc = new jsPDF('landscape');
        
        doc.setFillColor(10, 31, 68);
        doc.rect(0, 0, 297, 30, 'F');
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text("MASTER ATTENDANCE REGISTER", 148, 20, { align: 'center' });

        const dateColumns = detailedSummary.dates.slice(-10); // Last 10 sessions
        const head = [['Player Name', ...dateColumns, '%']];
        
        const body = detailedSummary.studentAttendance.map(student => [
            student.name,
            ...dateColumns.map(date => student.attendance[date] ? 'P' : 'A'),
            `${student.attendancePercentage.toFixed(0)}%`
        ]);

        autoTable(doc, {
            startY: 40,
            head: head,
            body: body,
            headStyles: { fillColor: [10, 31, 68], fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            styles: { halign: 'center' },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold' }
            }
        });

        doc.save(`Full_Attendance_Register_${new Date().toLocaleDateString()}.pdf`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[70vh]">
                <div className="text-center group">
                    <div className="w-20 h-20 border-8 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6 transition-transform group-hover:scale-110"></div>
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xl font-semibold text-primary/80"
                    >
                        Syncing Records...
                    </motion.p>
                </div>
            </div>
        );
    }

    if (user?.role === 'STUDENT') {
        return (
            <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-8 pb-12"
            >
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <motion.div variants={item}>
                        <h1 className="text-5xl font-extrabold text-[#0A1F44] tracking-tight mb-2">
                            My <span className="text-accent underline decoration-4 underline-offset-8">Performance</span>
                        </h1>
                        <p className="text-lg text-muted-foreground font-medium">Player Dashboard • {user.email}</p>
                    </motion.div>
                    <motion.div variants={item}>
                        <Button 
                            className="bg-[#0A1F44] hover:bg-[#1a2e5a] text-white px-8 py-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:translate-y-0 text-lg font-bold flex items-center gap-3"
                            onClick={handleExportPersonalPDF}
                        >
                            <Download className="w-6 h-6" /> Export My Report (PDF)
                        </Button>
                    </motion.div>
                </div>

                <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Attendance Rate" value={`${studentStats?.attendancePercentage?.toFixed(1) ?? '0.0'}%`} icon={TrendingUp} color="text-green-600" bgColor="bg-green-50" trend={+5.2} />
                    <StatCard title="Sessions Attended" value={studentStats?.sessionsAttended ?? 0} icon={Award} color="text-primary" bgColor="bg-primary/5" />
                    <StatCard title="Total Sessions" value={studentStats?.totalSessions ?? 0} icon={Calendar} color="text-accent" bgColor="bg-accent/5" />
                    <StatCard title="Status" value={studentStats?.recentAttendance?.[0]?.isPresent ? 'Active' : 'Missing'} subtitle={studentStats?.recentAttendance?.[0]?.date ?? 'No sessions'} icon={Clock} color="text-amber-600" bgColor="bg-amber-50" />
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <motion.div variants={item} className="lg:col-span-2">
                        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-gradient-to-br from-white to-slate-50">
                            <CardHeader className="bg-[#0A1F44] text-white pb-8">
                                <CardTitle className="text-2xl flex items-center gap-3"><Clock className="w-6 h-6 text-accent" /> Recent Activity</CardTitle>
                                <CardDescription className="text-blue-100/70">Your most recent attendance records</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    {studentStats?.recentAttendance?.map((record, i) => (
                                        <div key={i} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-xl ${record.isPresent ? 'bg-green-50' : 'bg-red-50'}`}>
                                                    {record.isPresent ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
                                                </div>
                                                <span className="font-bold text-slate-700 text-lg">{record.date}</span>
                                            </div>
                                            <span className={`text-sm font-black px-4 py-1.5 rounded-full ${record.isPresent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} uppercase tracking-widest`}>
                                                {record.isPresent ? 'Present' : 'Absent'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div variants={item} className="lg:col-span-3">
                        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden h-full">
                            <CardHeader className="pb-8">
                                <CardTitle className="text-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3"><Users className="w-6 h-6 text-accent" /> Squad Attendance</div>
                                    <span className="text-sm font-medium text-muted-foreground">Recent Sync</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-6">
                                    {recentAttendance.map((session, i) => (
                                        <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 transition-all hover:bg-white hover:shadow-xl group">
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-3">
                                                    <Calendar className="w-5 h-5 text-primary group-hover:scale-125 transition-transform" />
                                                    <span className="font-extrabold text-xl text-[#0A1F44]">{session.date}</span>
                                                </div>
                                                <span className="bg-[#0A1F44] text-white px-4 py-1.5 rounded-full text-xs font-bold ring-4 ring-blue-50">
                                                    {session.presentStudentNames.length} PLAYERS PRESENT
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {session.presentStudentNames.map((name, j) => (
                                                    <motion.span 
                                                        whileHover={{ scale: 1.05 }}
                                                        key={j} 
                                                        className="px-4 py-2 bg-white text-slate-700 text-sm font-bold rounded-xl border border-slate-200 shadow-sm"
                                                    >
                                                        {name}
                                                    </motion.span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </motion.div>
        );
    }

    // Admin Dashboard
    const adminStatCards = [
        { title: 'Practice Days', value: adminStats?.totalPracticeDays ?? 0, icon: Calendar, color: 'text-primary', bgColor: 'bg-primary/5' },
        { title: 'Total Squad', value: adminStats?.totalPlayers ?? 0, icon: Users, color: 'text-accent', bgColor: 'bg-accent/5' },
        { title: 'Avg Attendance', value: `${adminStats?.averageAttendance?.toFixed(1) ?? '0.0'}%`, icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-50' },
        { title: 'MVP Attendee', value: adminStats?.topAttendee?.name ?? 'N/A', subtitle: adminStats?.topAttendee?.attendancePercentage ? `${adminStats.topAttendee.attendancePercentage.toFixed(1)}%` : '', icon: Trophy, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    ];

    return (
        <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-8 pb-12"
        >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                <motion.div variants={item}>
                    <h1 className="text-5xl font-extrabold text-[#0A1F44] tracking-tight mb-2">
                        Control <span className="text-accent underline decoration-4 underline-offset-8">Central</span>
                    </h1>
                    <p className="text-lg text-muted-foreground font-medium">Global Practice Monitoring & Analytics</p>
                </motion.div>
                <motion.div variants={item}>
                   <Button 
                        variant="outline"
                        className="bg-white border-2 border-[#0A1F44] text-[#0A1F44] hover:bg-slate-50 px-8 py-6 rounded-2xl shadow-lg font-bold text-lg flex items-center gap-3"
                        onClick={handleExportDetailedAdminPDF}
                    >
                        <Download className="w-6 h-6" /> Master Attendance Register (PDF)
                    </Button>
                </motion.div>
            </div>

            <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {adminStatCards.map((stat, index) => (
                    <StatCard key={index} {...stat} />
                ))}
            </motion.div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <motion.div variants={item} className="xl:col-span-8">
                    <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="bg-[#0A1F44] text-white pb-8">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-2xl flex items-center gap-3"><Calendar className="w-6 h-6 text-accent" /> Attendance Matrix</CardTitle>
                                    <CardDescription className="text-white/60">Cross-player participation history (Last 10 sessions)</CardDescription>
                                </div>
                                <Trophy className="w-10 h-10 text-accent/50" />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-sm font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 z-10 w-48">Player Name</th>
                                        {detailedSummary?.dates.slice(-10).map((date, i) => (
                                            <th key={i} className="px-3 py-4 text-[10px] font-black text-slate-400 uppercase rotate-[-45deg] pb-8">{date.split('-').slice(1).join('/')}</th>
                                        ))}
                                        <th className="px-6 py-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right whitespace-nowrap">% RATE</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {detailedSummary?.studentAttendance.map((student, i) => (
                                        <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="px-6 py-5 font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-blue-50/50 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">{student.name}</td>
                                            {detailedSummary.dates.slice(-10).map((date, j) => (
                                                <td key={j} className="px-3 py-5 text-center">
                                                    {student.attendance[date] ? (
                                                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-sm shadow-green-200">
                                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center mx-auto grayscale opacity-30">
                                                            <XCircle className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-primary" 
                                                            style={{ width: `${student.attendancePercentage}%` }} 
                                                        />
                                                    </div>
                                                    <span className="font-black text-primary text-sm min-w-[3rem]">{student.attendancePercentage.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={item} className="xl:col-span-4 space-y-8">
                    <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl flex items-center gap-3">Quick Operations</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <ActionCard href="/students" icon={Users} title="Manage Students" desc="Add or edit players" />
                            <ActionCard href="/attendance" icon={Calendar} title="Mark Attendance" desc="Record today's session" color="accent" />
                            <ActionCard href="/reports" icon={TrendingUp} title="Advanced Analytics" desc="Financial & monthly stats" color="green" />
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-gradient-to-br from-[#0A1F44] to-[#1a2e5a] text-white p-8 relative">
                        <div className="relative z-10">
                            <Trophy className="w-16 h-16 text-accent mb-6" />
                            <h3 className="text-4xl font-black mb-2">Practice Ready?</h3>
                            <p className="text-blue-200 font-medium mb-8">Maintain 90%+ attendance to qualify for the first team squad selection.</p>
                            <Button className="w-full bg-accent hover:bg-yellow-500 text-[#0A1F44] font-black h-16 rounded-2xl text-xl shadow-2xl shadow-yellow-500/20">
                                View Training Schedule
                            </Button>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
                    </Card>
                </motion.div>
            </div>
        </motion.div>
    );
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    subtitle?: string;
    trend?: number;
}

function StatCard({ title, value, icon: Icon, color, bgColor, subtitle, trend }: StatCardProps) {
    return (
        <motion.div whileHover={{ y: -5 }}>
            <Card className="border-none shadow-xl rounded-2xl transition-all duration-300 hover:shadow-2xl overflow-hidden relative group">
                <div className={`absolute top-0 right-0 w-24 h-24 ${bgColor} rounded-bl-[4rem] group-hover:rounded-bl-[3rem] transition-all opacity-40`}></div>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-black text-slate-400 uppercase tracking-widest">{title}</CardTitle>
                    <Icon className={`w-8 h-8 ${color} relative z-10 group-hover:scale-110 transition-transform`} />
                </CardHeader>
                <CardContent className="relative z-10">
                    <div className="text-4xl font-extrabold text-[#0A1F44] tracking-tight">{value}</div>
                    <div className="flex items-center gap-2 mt-2">
                         {subtitle && <p className="text-sm text-slate-500 font-bold">{subtitle}</p>}
                         {trend && (
                            <div className="flex items-center text-green-600 text-xs font-black bg-green-50 px-2 py-0.5 rounded-md">
                                <TrendingUp className="w-3 h-3 mr-1" /> {trend}%
                            </div>
                         )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

interface ActionCardProps {
    href: string;
    icon: LucideIcon;
    title: string;
    desc: string;
    color?: 'primary' | 'accent' | 'green';
}

function ActionCard({ href, icon: Icon, title, desc, color = 'primary' }: ActionCardProps) {
    const variants: Record<string, string> = {
        primary: 'border-blue-100 hover:border-primary/40 bg-blue-50/20 hover:bg-blue-50/50',
        accent: 'border-yellow-100 hover:border-accent/40 bg-yellow-50/20 hover:bg-yellow-50/50',
        green: 'border-green-100 hover:border-green-400/40 bg-green-50/20 hover:bg-green-50/50',
    };
    
    const iconColors: Record<string, string> = {
        primary: 'text-primary',
        accent: 'text-accent',
        green: 'text-green-600',
    };

    return (
        <motion.a 
            whileHover={{ x: 8 }}
            href={href} 
            className={`flex items-center gap-6 p-6 rounded-3xl border-2 transition-all duration-300 group ${variants[color]}`}
        >
            <div className={`p-4 rounded-2xl bg-white shadow-sm ring-4 ring-offset-0 ${color === 'primary' ? 'ring-blue-100/50' : color === 'accent' ? 'ring-yellow-50' : 'ring-green-50' } shadow-sm group-hover:scale-110 transition-all`}>
                <Icon className={`w-8 h-8 ${iconColors[color]}`} />
            </div>
            <div>
                <h3 className="font-black text-xl text-[#0A1F44] mb-1 flex items-center gap-2">
                    {title} <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                </h3>
                <p className="text-sm text-slate-500 font-medium">{desc}</p>
            </div>
        </motion.a>
    );
}
