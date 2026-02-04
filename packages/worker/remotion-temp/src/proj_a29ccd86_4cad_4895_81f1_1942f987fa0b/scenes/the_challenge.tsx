import React, { useMemo } from 'react';
import {
	AbsoluteFill,
	useVideoConfig,
	useCurrentFrame,
	interpolate,
	spring,
	Easing,
} from 'remotion';
import {
	FadeIn,
	ScaleIn,
	GlowPulse,
	SPRING_CONFIGS,
} from '../../animations';

const ReservoirSamplingScene: React.FC = () => {
	const { width, height, fps } = useVideoConfig();
	const frame = useCurrentFrame();
	const minDim = Math.min(width, height);

	// Design Constants
	const COLORS = {
		background: '#0F172A',
		primary: '#3B82F6',
		secondary: '#10B981',
		accent: '#F59E0B',
		white: '#FFFFFF',
		text: '#94A3B8',
	};

	const nodeSize = minDim * 0.15;
	const reservoirWidth = minDim * 0.25;
	const reservoirHeight = minDim * 0.25;

	// Camera & Flow Logic
	// Fog clears and camera centers over the first 60 frames
	const fogOpacity = interpolate(frame, [0, 60], [0.8, 0], {
		extrapolateRight: 'clamp',
	});

	// The "Stream" - Persistent linear flow
	const streamSpeed = 4; // pixels per frame
	const streamOffset = frame * streamSpeed;

	// Reservoir Descent Animation (Starts from state of previous scene)
	const reservoirY = spring({
		frame,
		fps,
		from: -reservoirHeight,
		to: height * 0.45,
		config: SPRING_CONFIGS.modern,
	});

	// Block #1 Sequence
	// It should be already present in the stream and flow into the box
	const block1X = (width * 0.2) + streamOffset;
	const block1InReservoir = block1X > width * 0.5 - nodeSize / 2;

	// Block #1,000,000 Logic (Positioned far back)
	const largeN = 1000000;
	const millionthBlockX = width * 0.5 + (largeN * (nodeSize * 1.5)) - streamOffset;

	// Labels and UI
	const titleOpacity = interpolate(frame, [20, 50], [0, 1]);

	return (
		<AbsoluteFill style={{ backgroundColor: COLORS.background }}>
			{/* Persistent Header */}
			<div
				style={{
					position: 'absolute',
					top: height * 0.08,
					width: '100%',
					textAlign: 'center',
					opacity: titleOpacity,
				}}
			>
				<h1
					style={{
						color: COLORS.white,
						fontSize: height * 0.04,
						fontWeight: 800,
						margin: 0,
						fontFamily: 'sans-serif',
						textTransform: 'uppercase',
						letterSpacing: '2px',
					}}
				>
					Reservoir Sampling
				</h1>
				<p
					style={{
						color: COLORS.text,
						fontSize: height * 0.02,
						marginTop: height * 0.01,
					}}
				>
					Fairness across an infinite stream
				</p>
			</div>

			{/* The Reservoir Box */}
			<div
				style={{
					position: 'absolute',
					left: width * 0.5 - reservoirWidth / 2,
					top: reservoirY,
					width: reservoirWidth,
					height: reservoirHeight,
					borderRadius: minDim * 0.03,
					border: `${minDim * 0.008}px solid ${COLORS.primary}`,
					background: 'rgba(59, 130, 246, 0.1)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					boxShadow: `0 0 ${minDim * 0.05}px rgba(59, 130, 246, 0.3)`,
				}}
			>
				<GlowPulse color={COLORS.primary} speed="slow">
					<div
						style={{
							fontSize: minDim * 0.02,
							color: COLORS.primary,
							fontWeight: 'bold',
							position: 'absolute',
							bottom: -minDim * 0.05,
						}}
					>
						RESERVOIR (K=1)
					</div>
				</GlowPulse>

				{/* Block #1 entering and staying */}
				{block1InReservoir && (
					<ScaleIn>
						<div
							style={{
								width: nodeSize,
								height: nodeSize,
								backgroundColor: COLORS.secondary,
								borderRadius: '20%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: 'white',
								fontSize: nodeSize * 0.4,
								fontWeight: '900',
								boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
							}}
						>
							1
						</div>
					</ScaleIn>
				)}
			</div>

			{/* The Infinite Stream UI */}
			<div style={{ position: 'absolute', top: height * 0.75, width: '100%' }}>
				{/* Block #1,000,000 Reveal */}
				<div
					style={{
						position: 'absolute',
						left: millionthBlockX > width ? width - 100 : millionthBlockX,
						opacity: interpolate(millionthBlockX, [width + 200, width], [0, 1]),
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: minDim * 0.02,
					}}
				>
					<div
						style={{
							width: nodeSize,
							height: nodeSize,
							backgroundColor: COLORS.accent,
							borderRadius: '20%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							color: 'white',
							fontSize: nodeSize * 0.3,
							fontWeight: '900',
						}}
					>
						1M
					</div>
					<div
						style={{
							color: COLORS.accent,
							fontSize: minDim * 0.02,
							fontWeight: 'bold',
							whiteSpace: 'nowrap',
						}}
					>
                        Millionth Entry
					</div>
				</div>

				{/* Indicator line */}
				<svg
					style={{
						position: 'absolute',
						width: '100%',
						height: 100,
						overflow: 'visible',
					}}
				>
					<line
						x1="0"
						y1="50"
						x2="100%"
						y2="50"
						stroke={COLORS.text}
						strokeWidth="2"
						strokeDasharray="10 10"
						opacity="0.3"
					/>
				</svg>
			</div>

			{/* Explanation Text Overlay */}
			<div
				style={{
					position: 'absolute',
					bottom: height * 0.1,
					width: '80%',
					left: '10%',
					backgroundColor: 'rgba(15, 23, 42, 0.8)',
					padding: minDim * 0.04,
					borderRadius: minDim * 0.02,
					border: `1px solid rgba(255,255,255,0.1)`,
					backdropFilter: 'blur(10px)',
				}}
			>
				<FadeIn delay={40}>
					<div
						style={{
							color: COLORS.white,
							fontSize: height * 0.025,
							lineHeight: 1.5,
							textAlign: 'center',
							fontFamily: 'sans-serif',
						}}
					>
						Whether it's the <span style={{ color: COLORS.secondary, fontWeight: 'bold' }}>first</span> data point
						or the <span style={{ color: COLORS.accent, fontWeight: 'bold' }}>millionth</span>,
						the mathematical chance of being selected remains <span style={{ color: COLORS.primary, fontWeight: 'bold' }}>identical</span>.
					</div>
				</FadeIn>
			</div>

			{/* Fog of Infinity (Transition from previous scene) */}
			<div
				style={{
					position: 'absolute',
					top: 0,
					right: 0,
					width: '100%',
					height: '100%',
					background: `linear-gradient(to left, ${COLORS.background}, transparent)`,
					opacity: fogOpacity,
					pointerEvents: 'none',
				}}
			/>

			{/* Smooth Zoom Effect */}
			<div
				style={{
					position: 'absolute',
					width: '100%',
					height: '100%',
					border: `${minDim * 0.02}px solid ${COLORS.primary}`,
					opacity: interpolate(frame, [0, 20], [0, 0.15]),
					pointerEvents: 'none',
				}}
			/>
		</AbsoluteFill>
	);
};

export default ReservoirSamplingScene;