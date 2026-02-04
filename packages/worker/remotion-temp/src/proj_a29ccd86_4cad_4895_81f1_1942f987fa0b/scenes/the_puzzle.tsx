import React from 'react';
import {
	AbsoluteFill,
	useVideoConfig,
	useCurrentFrame,
	interpolate,
	spring,
	Easing,
} from 'remotion';
import {
	FadeInUp,
	GlowPulse,
	BounceIn,
	PremiumStagger,
} from '../../animations';

const COLORS = {
	background: '#0F172A',
	primary: '#3B82F6',
	secondary: '#10B981',
	accent: '#F59E0B',
	white: '#ffffff',
	text: '#F8FAFC',
};

export default function ReservoirExpansionScene() {
	const { width, height, fps } = useVideoConfig();
	const frame = useCurrentFrame();
	const minDim = Math.min(width, height);

	// Timings
	const expansionStart = 30;
	const expansionDuration = 60;
	const formulaShiftFrame = 90;

	// Animation Values
	const expansionProgress = spring({
		frame: frame - expansionStart,
		fps,
		config: { damping: 15, stiffness: 60 },
	});

	const formulaShift = spring({
		frame: frame - formulaShiftFrame,
		fps,
		config: { damping: 12, stiffness: 80 },
	});

	// Persistent Stream Motion (simulating the speed from previous scene)
	const speed = 8;
	const streamOffset = (frame * speed) % (width * 0.4);

	// Reservoir Sizing
	const reservoirWidth = width * 0.18;
	const expandedReservoirWidth = width * 0.85;
	const currentReservoirWidth = interpolate(
		expansionProgress,
		[0, 1],
		[reservoirWidth, expandedReservoirWidth]
	);

	const slotWidth = (expandedReservoirWidth - (minDim * 0.08)) / 5;
	const showSlots = expansionProgress > 0.5;

	// Formula Transition
	const denominatorValue = Math.floor(interpolate(frame, [0, 1500], [1000, 5000]));

	return (
		<AbsoluteFill style={{ backgroundColor: COLORS.background, color: COLORS.text, fontFamily: 'sans-serif' }}>
			{/* 1. Header Area (First 15%) */}
			<div style={{
				height: height * 0.15,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				paddingTop: height * 0.05
			}}>
				<FadeInUp>
					<h1 style={{
						fontSize: height * 0.045,
						margin: 0,
						fontWeight: 800,
						background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondary})`,
						WebkitBackgroundClip: 'text',
						WebkitTextFillColor: 'transparent',
						textAlign: 'center'
					}}>
						SAMPLED SET
					</h1>
				</FadeInUp>
			</div>

			{/* 2. Main Visual Area (60%) */}
			<div style={{
				height: height * 0.6,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				position: 'relative'
			}}>
				
				{/* Probability Formula Above Reservoir */}
				<div style={{
					marginBottom: height * 0.05,
					fontSize: height * 0.06,
					fontWeight: 'bold',
					display: 'flex',
					alignItems: 'center',
					gap: minDim * 0.02
				}}>
					<div style={{ position: 'relative' }}>
						<span style={{ 
							opacity: 1 - formulaShift, 
							position: 'absolute',
							left: 0,
							color: COLORS.accent 
						}}>1</span>
						<span style={{ 
							opacity: formulaShift, 
							color: COLORS.accent,
							transform: `scale(${interpolate(formulaShift, [0, 1], [0.5, 1])})`
						}}>k</span>
					</div>
					<span style={{ color: COLORS.white }}>/</span>
					<span style={{ color: COLORS.white }}>{denominatorValue}</span>
					{formulaShift > 0.8 && (
						<BounceIn delay={10}>
							<span style={{ color: COLORS.accent, marginLeft: minDim * 0.02 }}>?</span>
						</BounceIn>
					)}
				</div>

				{/* The Reservoir Container */}
				<div style={{
					width: currentReservoirWidth,
					height: height * 0.15,
					borderRadius: minDim * 0.02,
					border: `4px solid ${COLORS.primary}`,
					background: 'rgba(59, 130, 246, 0.1)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					overflow: 'hidden',
					boxShadow: expansionProgress > 0 ? `0 0 ${20 * expansionProgress}px ${COLORS.primary}44` : 'none'
				}}>
					{!showSlots ? (
						<GlowPulse>
							<div style={{
								width: reservoirWidth * 0.7,
								height: height * 0.08,
								backgroundColor: COLORS.secondary,
								borderRadius: minDim * 0.01,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: 'white',
								fontSize: height * 0.04,
								fontWeight: 'bold'
							}}>
								{denominatorValue % 50}
							</div>
						</GlowPulse>
					) : (
						<div style={{
							display: 'flex',
							gap: minDim * 0.015,
							padding: minDim * 0.01
						}}>
							<PremiumStagger speed="fast">
								{[1, 2, 3, 4, 5].map((i) => (
									<div key={i} style={{
										width: slotWidth,
										height: height * 0.1,
										backgroundColor: i === 1 ? COLORS.secondary : 'rgba(255,255,255,0.05)',
										border: `2px dashed ${i === 1 ? COLORS.secondary : 'rgba(255,255,255,0.2)'}`,
										borderRadius: minDim * 0.01,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontSize: height * 0.03,
										color: 'white',
										fontWeight: 'bold'
									}}>
										{i === 1 ? (denominatorValue % 50) : '?'}
									</div>
								))}
							</PremiumStagger>
						</div>
					)}
				</div>

				{/* Data Stream (Background) */}
				<div style={{
					position: 'absolute',
					bottom: height * 0.05,
					width: '100%',
					height: height * 0.08,
					display: 'flex',
					gap: minDim * 0.02,
					transform: `translateX(${-streamOffset}px)`,
					opacity: 0.4
				}}>
					{Array.from({ length: 12 }).map((_, i) => (
						<div key={i} style={{
							minWidth: width * 0.15,
							height: '100%',
							backgroundColor: 'rgba(255,255,255,0.1)',
							borderRadius: minDim * 0.01,
							border: '1px solid rgba(255,255,255,0.2)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: height * 0.02,
							color: 'rgba(255,255,255,0.5)'
						}}>
							{denominatorValue + i}
						</div>
					))}
				</div>
			</div>

			{/* 3. Labels/Captions (25%) */}
			<div style={{
				height: height * 0.25,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				padding: `0 ${width * 0.1}px`,
				textAlign: 'center',
				gap: minDim * 0.03
			}}>
				<div style={{
					padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
					backgroundColor: 'rgba(255,255,255,0.05)',
					borderRadius: minDim * 0.02,
					borderLeft: `4px solid ${COLORS.accent}`,
					backdropFilter: 'blur(10px)'
				}}>
					<p style={{
						fontSize: height * 0.028,
						lineHeight: 1.4,
						margin: 0,
						color: COLORS.white
					}}>
						The algorithm works for one winner. 
						<strong style={{ color: COLORS.accent, display: 'block', marginTop: minDim * 0.01 }}>
							How do we modify it for FIVE winners?
						</strong>
					</p>
				</div>

				{/* Visual Legend */}
				<div style={{
					display: 'flex',
					gap: minDim * 0.05,
					opacity: interpolate(frame, [0, 30], [0, 1])
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: COLORS.accent }} />
						<span style={{ fontSize: height * 0.015, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>Target (k)</span>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: COLORS.primary }} />
						<span style={{ fontSize: height * 0.015, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>Reservoir</span>
					</div>
				</div>
			</div>

			{/* SVG Overlay for Connections or Arrows */}
			<svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', top: 0, left: 0 }}>
				{/* Only show pointer arrow if expansion is done */}
				{expansionProgress > 0.9 && (
					<g style={{ opacity: formulaShift }}>
						<path 
							d={`M ${width/2 - 20} ${height * 0.3} L ${width/2} ${height * 0.35} L ${width/2 + 20} ${height * 0.3}`} 
							fill="none" 
							stroke={COLORS.accent} 
							strokeWidth="4"
							strokeLinecap="round"
						/>
					</g>
				)}
			</svg>
		</AbsoluteFill>
	);
}