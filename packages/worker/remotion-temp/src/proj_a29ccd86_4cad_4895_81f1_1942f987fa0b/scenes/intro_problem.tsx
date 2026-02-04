import React from 'react';
import {
	AbsoluteFill,
	useVideoConfig,
	useCurrentFrame,
	interpolate,
	spring,
} from 'remotion';
import {
	BounceIn,
	FadeInUp,
	ZoomIn,
	PremiumStagger,
	GlowPulse,
} from '../../animations';

const COLORS = {
	background: '#0F172A',
	primary: '#3B82F6',
	secondary: '#10B981',
	accent: '#F59E0B',
	error: '#EF4444',
	white: '#FFFFFF',
	text: '#E2E8F0',
};

const DataBlock = ({
	index,
	width,
	height,
	offset,
}: {
	index: number;
	width: number;
	height: number;
	offset: number;
}) => {
	const minDim = Math.min(width, height);
	const blockSize = minDim * 0.12;

	return (
		<div
			style={{
				width: blockSize,
				height: blockSize,
				background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
				borderRadius: minDim * 0.02,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				color: 'white',
				fontWeight: 'bold',
				fontSize: minDim * 0.045,
				boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
				transform: `translateX(${offset}px)`,
				position: 'absolute',
				top: height * 0.45,
				left: (index * blockSize * 1.4) % (width * 1.5),
			}}
		>
			<span style={{opacity: 0.8}}>#</span>
			{1000 + (index % 899)}
		</div>
	);
};

export const ReservoirSamplingIntro: React.FC = () => {
	const {width, height, fps} = useVideoConfig();
	const frame = useCurrentFrame();
	const minDim = Math.min(width, height);

	// High velocity stream logic
	const streamSpeed = width * 0.6; // pixels per second
	const streamOffset = -(frame * (streamSpeed / fps));

	// Animation for the "X" on RAM
	const ramEntranceTrigger = 60;
	const errorStrikeProgress = spring({
		frame: frame - ramEntranceTrigger - 30,
		fps,
		config: {stiffness: 200, damping: 10},
	});

	// Title animation
	const titleSpring = spring({
		frame,
		fps,
		config: {damping: 12, stiffness: 100},
	});

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.background, overflow: 'hidden'}}>
			{/* 1. HEADER SECTION (Top 15%) */}
			<div
				style={{
					height: height * 0.15,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					paddingTop: height * 0.05,
				}}
			>
				<BounceIn>
					<h1
						style={{
							margin: 0,
							color: COLORS.white,
							fontSize: minDim * 0.08,
							textAlign: 'center',
							fontWeight: 900,
							letterSpacing: '-0.02em',
							textShadow: `0 0 20px ${COLORS.primary}44`,
						}}
					>
						RESERVOIR SAMPLING
					</h1>
				</BounceIn>
				<FadeInUp delay={20}>
					<p
						style={{
							margin: 0,
							color: COLORS.secondary,
							fontSize: minDim * 0.04,
							fontWeight: 500,
						}}
					>
						Infinite Stream • Single Winner
					</p>
				</FadeInUp>
			</div>

			{/* 2. MAIN VISUAL (Middle 60%) */}
			<div style={{height: height * 0.6, position: 'relative'}}>
				{/* The Infinite Stream of Data Blocks */}
				<div
					style={{
						position: 'absolute',
						width: '200%',
						height: '100%',
						transform: `scale(${interpolate(titleSpring, [0, 1], [0.8, 1])})`,
					}}
				>
					{[...Array(20)].map((_, i) => (
						<DataBlock
							key={i}
							index={i}
							width={width}
							height={height}
							offset={streamOffset}
						/>
					))}
				</div>

				{/* The Reservoir Container (Persistent Element) */}
				<div
					style={{
						position: 'absolute',
						left: '50%',
						top: height * 0.45,
						transform: 'translate(-50%, -50%)',
					}}
				>
					<GlowPulse color={COLORS.accent}>
						<div
							style={{
								width: minDim * 0.25,
								height: minDim * 0.25,
								border: `${minDim * 0.01}px dashed ${COLORS.accent}`,
								borderRadius: minDim * 0.03,
								background: `${COLORS.accent}11`,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								backdropFilter: 'blur(4px)',
							}}
						>
							<span
								style={{
									color: COLORS.accent,
									fontSize: minDim * 0.1,
									fontWeight: 'bold',
								}}
							>
								?
							</span>
						</div>
					</GlowPulse>
					<div
						style={{
							position: 'absolute',
							bottom: -minDim * 0.08,
							width: '100%',
							textAlign: 'center',
							color: COLORS.accent,
							fontSize: minDim * 0.035,
							fontWeight: 700,
						}}
					>
						RESERVOIR (K=1)
					</div>
				</div>
			</div>

			{/* 3. CAPTION / LOGIC SECTION (Bottom 25%) */}
			<AbsoluteFill
				style={{
					top: height * 0.75,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: minDim * 0.03,
				}}
			>
				{/* RAM Icon with "X" to explain the constraint */}
				<div style={{position: 'relative'}}>
					<ZoomIn delay={ramEntranceTrigger}>
						<div
							style={{
								padding: minDim * 0.04,
								background: 'rgba(255,255,255,0.05)',
								borderRadius: minDim * 0.03,
								border: `1px solid ${COLORS.text}33`,
								display: 'flex',
								alignItems: 'center',
								gap: minDim * 0.03,
							}}
						>
							<svg
								viewBox="0 0 24 24"
								width={minDim * 0.08}
								height={minDim * 0.08}
								stroke={COLORS.text}
								strokeWidth="2"
								fill="none"
							>
								<path d="M2 9h20v6H2zM6 9v6M10 9v6M14 9v6M18 9v6" />
							</svg>
							<span
								style={{
									color: COLORS.text,
									fontSize: minDim * 0.04,
									fontWeight: 600,
								}}
							>
								Limited RAM
							</span>
						</div>
					</ZoomIn>

					{/* The Red X */}
					<svg
						style={{
							position: 'absolute',
							top: -minDim * 0.02,
							left: -minDim * 0.02,
							width: minDim * 0.4,
							height: minDim * 0.15,
							pointerEvents: 'none',
						}}
					>
						<line
							x1="10%"
							y1="20%"
							x2="90%"
							y2="80%"
							stroke={COLORS.error}
							strokeWidth={minDim * 0.015}
							strokeLinecap="round"
							style={{
								strokeDasharray: 1000,
								strokeDashoffset: (1 - errorStrikeProgress) * 1000,
							}}
						/>
						<line
							x1="10%"
							y1="80%"
							x2="90%"
							y2="20%"
							stroke={COLORS.error}
							strokeWidth={minDim * 0.015}
							strokeLinecap="round"
							style={{
								strokeDasharray: 1000,
								strokeDashoffset: (1 - errorStrikeProgress) * 1000,
							}}
						/>
					</svg>
				</div>

				{/* Problem statement */}
				<PremiumStagger startDelay={120}>
					<div
						style={{
							color: COLORS.text,
							fontSize: minDim * 0.045,
							maxWidth: '80%',
							textAlign: 'center',
							lineHeight: 1.4,
						}}
					>
						Millions of items incoming...
					</div>
					<div
						style={{
							color: COLORS.error,
							fontSize: minDim * 0.05,
							fontWeight: 800,
						}}
					>
						CANNOT STORE ALL DATA
					</div>
				</PremiumStagger>
			</AbsoluteFill>

			{/* Decorative background grid */}
			<svg
				width="100%"
				height="100%"
				style={{position: 'absolute', zIndex: -1, opacity: 0.1}}
			>
				<defs>
					<pattern
						id="grid"
						width={minDim * 0.1}
						height={minDim * 0.1}
						patternUnits="userSpaceOnUse"
					>
						<path
							d={`M ${minDim * 0.1} 0 L 0 0 0 ${minDim * 0.1}`}
							fill="none"
							stroke={COLORS.primary}
							strokeWidth="1"
						/>
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#grid)" />
			</svg>
		</AbsoluteFill>
	);
};

export default ReservoirSamplingIntro;