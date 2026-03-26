/**
 * GlucoseChart — Reusable glucose trajectory visualization.
 * 
 * Renders a line chart showing predicted blood glucose over time.
 * Uses SVG for cross-platform compatibility (web + React Native).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 180;
const PADDING = { top: 20, right: 20, bottom: 30, left: 45 };
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

// Glucose zones (mg/dL)
const ZONES = {
  low: 70,
  normal_low: 80,
  normal_high: 100,
  elevated: 140,
  high: 180,
};

export default function GlucoseChart({ trajectory = [], title = "Predicted Glucose Trajectory" }) {
  if (!trajectory || trajectory.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.noData}>No trajectory data available</Text>
      </View>
    );
  }

  // Compute data ranges
  const times = trajectory.map(p => p.time_minutes);
  const glucoses = trajectory.map(p => p.glucose);
  const maxTime = Math.max(...times);
  const minGlucose = Math.max(60, Math.min(...glucoses) - 10);
  const maxGlucose = Math.min(200, Math.max(...glucoses) + 10);

  // Scale functions
  const scaleX = (t) => PADDING.left + (t / maxTime) * PLOT_WIDTH;
  const scaleY = (g) => PADDING.top + PLOT_HEIGHT - ((g - minGlucose) / (maxGlucose - minGlucose)) * PLOT_HEIGHT;

  // Build SVG path
  const pathData = trajectory
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.time_minutes)} ${scaleY(p.glucose)}`)
    .join(' ');

  // Area fill path (for gradient under the line)
  const areaPath = pathData +
    ` L ${scaleX(trajectory[trajectory.length - 1].time_minutes)} ${scaleY(minGlucose)}` +
    ` L ${scaleX(trajectory[0].time_minutes)} ${scaleY(minGlucose)} Z`;

  // Peak point
  const peak = trajectory.reduce((max, p) => p.glucose > max.glucose ? p : max, trajectory[0]);

  // Y-axis labels
  const yLabels = [];
  const step = (maxGlucose - minGlucose) / 4;
  for (let i = 0; i <= 4; i++) {
    yLabels.push(Math.round(minGlucose + step * i));
  }

  // X-axis labels (every hour)
  const xLabels = [];
  for (let t = 0; t <= maxTime; t += 60) {
    xLabels.push(t);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="glucoseGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4A6E52" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#4A6E52" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Normal zone background */}
        <Rect
          x={PADDING.left}
          y={scaleY(ZONES.normal_high)}
          width={PLOT_WIDTH}
          height={scaleY(ZONES.normal_low) - scaleY(ZONES.normal_high)}
          fill="#4A6E52"
          opacity={0.1}
        />

        {/* Grid lines */}
        {yLabels.map((val, i) => (
          <Line
            key={`grid-${i}`}
            x1={PADDING.left}
            y1={scaleY(val)}
            x2={PADDING.left + PLOT_WIDTH}
            y2={scaleY(val)}
            stroke="#5B5B5B"
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#glucoseGrad)" />

        {/* Glucose line */}
        <Path
          d={pathData}
          fill="none"
          stroke="#4A6E52"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Peak marker */}
        <Circle
          cx={scaleX(peak.time_minutes)}
          cy={scaleY(peak.glucose)}
          r={4}
          fill="#C8B08C"
          stroke="#2E2E2E"
          strokeWidth={2}
        />
        <SvgText
          x={scaleX(peak.time_minutes)}
          y={scaleY(peak.glucose) - 10}
          textAnchor="middle"
          fontSize={10}
          fill="#C8B08C"
          fontWeight="bold"
        >
          {Math.round(peak.glucose)}
        </SvgText>

        {/* Y-axis labels */}
        {yLabels.map((val, i) => (
          <SvgText
            key={`y-${i}`}
            x={PADDING.left - 8}
            y={scaleY(val) + 4}
            textAnchor="end"
            fontSize={9}
            fill="#A3A3A3"
          >
            {val}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {xLabels.map((t, i) => (
          <SvgText
            key={`x-${i}`}
            x={scaleX(t)}
            y={CHART_HEIGHT - 5}
            textAnchor="middle"
            fontSize={9}
            fill="#A3A3A3"
          >
            {t === 0 ? 'Now' : `${t / 60}h`}
          </SvgText>
        ))}

        {/* Axes */}
        <Line
          x1={PADDING.left}
          y1={PADDING.top}
          x2={PADDING.left}
          y2={PADDING.top + PLOT_HEIGHT}
          stroke="#5B5B5B"
          strokeWidth={1}
        />
        <Line
          x1={PADDING.left}
          y1={PADDING.top + PLOT_HEIGHT}
          x2={PADDING.left + PLOT_WIDTH}
          y2={PADDING.top + PLOT_HEIGHT}
          stroke="#5B5B5B"
          strokeWidth={1}
        />
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4A6E52' }]} />
          <Text style={styles.legendText}>Glucose (mg/dL)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#C8B08C' }]} />
          <Text style={styles.legendText}>Peak: {Math.round(peak.glucose)} mg/dL</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
  },
  title: {
    color: '#C8B08C',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  noData: {
    color: '#A3A3A3',
    fontSize: 14,
    padding: 30,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    color: '#A3A3A3',
    fontSize: 11,
  },
});
