import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const FEE_DATA = [
  { name: "Creator Share", value: 50, color: "hsl(var(--primary))" },
  { name: "Marketing", value: 30, color: "hsl(220, 70%, 55%)" },
  { name: "System", value: 20, color: "hsl(var(--muted-foreground))" },
];

export function FeeDistributionPie() {
  return (
    <div className="flex items-center gap-4">
      {/* Pie Chart */}
      <div className="w-24 h-24 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={FEE_DATA}
              cx="50%"
              cy="50%"
              innerRadius={20}
              outerRadius={40}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {FEE_DATA.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value}%`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2 text-sm">
        {FEE_DATA.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.name}</span>
            </div>
            <span className="font-semibold" style={{ color: item.color }}>
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
