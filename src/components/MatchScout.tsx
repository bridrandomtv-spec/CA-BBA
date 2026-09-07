import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Target, Users, Activity } from 'lucide-react';

export default function MatchScout() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activePlayer, setActivePlayer] = useState('team');

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 300;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    
    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();
    
    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background-color', '#14532d') // emerald-900 roughly
      .style('border', '2px solid #064e3b') // emerald-900 border
      .style('border-radius', '12px');

    // Draw pitch lines
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    // Pitch border
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', w)
      .attr('height', h)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.4)')
      .attr('stroke-width', 2);

    // Halfway line
    g.append('line')
      .attr('x1', 0)
      .attr('y1', h / 2)
      .attr('x2', w)
      .attr('y2', h / 2)
      .attr('stroke', 'rgba(255,255,255,0.4)')
      .attr('stroke-width', 2);

    // Center circle
    g.append('circle')
      .attr('cx', w / 2)
      .attr('cy', h / 2)
      .attr('r', 30)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.4)')
      .attr('stroke-width', 2);

    // Penalty areas
    g.append('rect')
      .attr('x', w / 2 - 60)
      .attr('y', 0)
      .attr('width', 120)
      .attr('height', 50)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.4)')
      .attr('stroke-width', 2);

    g.append('rect')
      .attr('x', w / 2 - 60)
      .attr('y', h - 50)
      .attr('width', 120)
      .attr('height', 50)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.4)')
      .attr('stroke-width', 2);

    // Heatmap data points
    let dataPoints: { x: number; y: number; weight: number }[] = [];
    if (activePlayer === 'team') {
      dataPoints = [
        { x: 30, y: 70, weight: 5 },
        { x: 50, y: 150, weight: 8 },
        { x: 80, y: 100, weight: 6 },
        { x: 120, y: 80, weight: 9 },
        { x: 200, y: 120, weight: 4 },
        { x: 160, y: 250, weight: 7 },
        { x: 230, y: 300, weight: 5 },
        { x: 130, y: 320, weight: 8 },
        { x: 80, y: 280, weight: 6 },
        { x: 100, y: 200, weight: 10 },
      ];
    } else if (activePlayer === 'yacine') {
      dataPoints = [
        { x: 120, y: 100, weight: 9 },
        { x: 140, y: 80, weight: 8 },
        { x: 130, y: 120, weight: 7 },
        { x: 160, y: 90, weight: 6 },
        { x: 110, y: 70, weight: 5 },
      ];
    } else if (activePlayer === 'riadh') {
      dataPoints = [
        { x: 40, y: 200, weight: 9 },
        { x: 50, y: 220, weight: 8 },
        { x: 30, y: 180, weight: 7 },
        { x: 60, y: 250, weight: 6 },
        { x: 45, y: 210, weight: 5 },
      ];
    }

    const heatmapLayer = g.append('g').attr('class', 'heatmap-layer');

    const colorScale = d3.scaleLinear<string>()
      .domain([0, 10])
      .range(['rgba(234, 179, 8, 0)', 'rgba(234, 179, 8, 0.8)']);

    heatmapLayer.selectAll('circle.heat')
      .data(dataPoints)
      .enter()
      .append('circle')
      .attr('class', 'heat')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.weight * 4)
      .attr('fill', d => colorScale(d.weight))
      .style('filter', 'blur(8px)')
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .attr('opacity', 1);

    // Tactical arrows (Team view)
    if (activePlayer === 'team') {
      const defs = svg.append("defs");
      defs.append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 5)
        .attr("refY", 5)
        .attr("markerWidth", 4)
        .attr("markerHeight", 4)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z")
        .attr("fill", "#fbbf24");

      g.append("line")
        .attr("x1", 60)
        .attr("y1", 280)
        .attr("x2", 60)
        .attr("y2", 150)
        .attr("stroke", "#fbbf24")
        .attr("stroke-width", 3)
        .attr("marker-end", "url(#arrow)")
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0)
        .transition()
        .delay(500)
        .duration(1000)
        .attr("opacity", 0.8);
        
      g.append("line")
        .attr("x1", 200)
        .attr("y1", 280)
        .attr("x2", 200)
        .attr("y2", 150)
        .attr("stroke", "#fbbf24")
        .attr("stroke-width", 3)
        .attr("marker-end", "url(#arrow)")
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0)
        .transition()
        .delay(800)
        .duration(1000)
        .attr("opacity", 0.8);
    }

  }, [activePlayer]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Target className="text-yellow-500" size={20} />
            كشاف المباراة
          </h3>
          <p className="text-xs text-zinc-400 mt-1">تحليل تكتيكي وخريطة حرارية</p>
        </div>
      </div>
      
      <div className="flex bg-zinc-800/50 p-1 rounded-xl mb-4">
        <button 
          onClick={() => setActivePlayer('team')}
          className={`flex-1 flex justify-center items-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors ${activePlayer === 'team' ? 'bg-yellow-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
        >
          <Users size={14} /> الفريق
        </button>
        <button 
          onClick={() => setActivePlayer('yacine')}
          className={`flex-1 flex justify-center items-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors ${activePlayer === 'yacine' ? 'bg-yellow-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
        >
          <Activity size={14} /> ياسين (10)
        </button>
        <button 
          onClick={() => setActivePlayer('riadh')}
          className={`flex-1 flex justify-center items-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors ${activePlayer === 'riadh' ? 'bg-yellow-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
        >
          <Activity size={14} /> رياض (9)
        </button>
      </div>

      <div className="w-full aspect-[3/4] bg-zinc-950 rounded-xl overflow-hidden relative shadow-inner">
        <svg ref={svgRef}></svg>
      </div>
      
      <div className="mt-4 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
        <h4 className="text-sm font-bold text-white mb-2">التحليل التكتيكي</h4>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {activePlayer === 'team' 
            ? 'يعتمد الفريق على الضغط العالي واللعب على الأطراف، مع تركيز التمريرات في العمق الهجومي.'
            : activePlayer === 'yacine'
            ? 'يتمركز اللاعب بشكل أساسي في منتصف ملعب الخصم ويميل للعب كصانع ألعاب متقدم، مما يزيد من خطورة الهجمات.'
            : 'يتحرك اللاعب كثيراً على الجناح الأيسر لفتح المساحات وخلق فرص العرضيات للمهاجمين.'}
        </p>
      </div>
    </div>
  );
}
