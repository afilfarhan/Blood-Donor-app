
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Person } from '../types.ts';
import { BLOOD_GROUPS } from '../constants.tsx';

interface BloodStatsProps {
  people: Person[];
}

const BloodStats: React.FC<BloodStatsProps> = ({ people }) => {
  const data = useMemo(() => {
    const counts = BLOOD_GROUPS.reduce((acc, bg) => {
      acc[bg] = people.filter(p => p.bloodGroup === bg).length;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [people]);

  const getGroupColor = (name: string) => {
    const colors: Record<string, string> = {
      'A+': '#ef4444',
      'A-': '#f87171',
      'B+': '#f43f5e',
      'B-': '#fb7185',
      'AB+': '#8b5cf6',
      'AB-': '#a78bfa',
      'O+': '#f97316',
      'O-': '#fb923c'
    };
    return colors[name] || '#9ca3af';
  };

  if (people.length === 0) {
    return (
      <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[350px] text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <p className="text-gray-400 font-semibold italic">Awaiting donor registrations...</p>
        <p className="text-gray-300 text-sm mt-2 max-w-xs">Register your first donors to unlock distribution analytics and inventory insights.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Group Distribution</h3>
            <p className="text-2xl font-black text-gray-900">{people.length} <span className="text-xs font-medium text-gray-400">Total Donors</span></p>
          </div>
          <div className="bg-green-50 px-3 py-1 rounded-full flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-green-700 uppercase">Live Stats</span>
          </div>
        </div>
        
        <div className="h-[320px] w-full relative block overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={75}
                outerRadius={105}
                paddingAngle={6}
                dataKey="value"
                nameKey="name"
                strokeWidth={0}
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={getGroupColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '16px' }}
                itemStyle={{ fontSize: '14px', fontWeight: '800' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={40} 
                iconType="circle" 
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', fontWeight: '700', paddingTop: '20px', color: '#6b7280' }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Donor Inventory</h3>
            <p className="text-2xl font-black text-gray-900">{data.length} <span className="text-xs font-medium text-gray-400">Active Groups</span></p>
          </div>
          <div className="flex gap-1.5">
             <div className="w-2 h-2 rounded-full bg-gray-100"></div>
             <div className="w-2 h-2 rounded-full bg-gray-100"></div>
             <div className="w-2 h-2 rounded-full bg-gray-100"></div>
          </div>
        </div>

        <div className="h-[320px] w-full relative block overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f9fafb" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: '700' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: '700' }} 
              />
              <Tooltip 
                cursor={{ fill: '#f9fafb', radius: 12 }}
                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '16px' }}
                itemStyle={{ fontSize: '14px', fontWeight: '800' }}
              />
              <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={36} isAnimationActive={false}>
                {data.map((entry) => (
                  <Cell key={`bar-${entry.name}`} fill={getGroupColor(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default BloodStats;
