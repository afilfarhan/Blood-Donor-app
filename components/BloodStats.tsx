
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Person } from '../types';
import { BLOOD_GROUPS, BLOOD_GROUP_COLORS } from '../constants';

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
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));
  }, [people]);

  if (people.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center min-h-[300px]">
        <p className="text-gray-400 italic">Add some donors to see statistics</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribution by Group</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name.includes('A') ? '#ef4444' : entry.name.includes('B') ? '#f43f5e' : '#f97316'} 
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Donor Counts</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default BloodStats;
