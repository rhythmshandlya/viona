import React from 'react';
import {
	AbsoluteFill,
	useVideoConfig,
	useCurrentFrame,
	interpolate,
	spring,
} from 'remotion';
import {
	GlowPulse,
	BounceIn,
} from '../../animations';

const ReservoirSamplingSceneFour: React.FC = () => {
	const { width, height, fps } = useVideoConfig();
	const frame = useCurrentFrame();
	const minDim = Math.min(width, height);

	// Styles & Sizes
	const bgColor = '#0f172a';
	const primaryColor = '#3b82f6'; // Blue
	const secondaryColor = '#10b981'; // Green
	const accentColor = '#f59e0b'; // Amber
	const reservoirSize = minDim * 0.4;
	const blockSize = reservoirSize * 0.7;

	// Animation progress
	const springConfig = { damping: 12, stiffness: 80 };
	const labelEntrance = spring({
		frame: frame - 15,
		fps,
		config: springConfig,
	});

	// Flowing Stream logic (Persistent from previous)
	const streamY = height * 0.55;
	const speed = 4; // Constant flow speed
	const blockGap = minDim * 0.25;

	// This specific scene focuses on Block #1 already in the box
	// We render the background stream of "future" blocks
	const futureBlocks = [2, 3, 4, 5, 6];

	return (
		<AbsoluteFill style={{ backgroundColor: bgColor, color: 'white', fontFamily: 'sans-serif' }}>
			{/* 1. Header Area (Top 15%) */}
			<div
				style={{
					position: 'absolute',
					top: height * 0.05,
					width: '100%',
					textAlign: 'center',
					display: 'flex',
					flexDirection: 'column',
					gap: height * 0.01,
				}}
			>
				<BounceIn delay={10}>
					<h1
						style={{
							fontSize: height * 0.045,
							fontWeight: 800,
							margin: 0,
							color: 'white',
							textTransform: 'uppercase',
							letterSpacing: '2px',
						}}
					>
						Reservoir Sampling
					</h1>
				</BounceIn>
			</div>

			{/* 2. Main Visual (Middle 60%) */}
			<AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				{/* The Reservoir Container (Persistent) */}
				<div
					style={{
						width: reservoirSize,
						height: reservoirSize,
						border: `${minDim * 0.01}px solid ${primaryColor}`,
						borderRadius: minDim * 0.04,
						position: 'absolute',
						top: height * 0.5 - reservoirSize * 0.5,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: 'rgba(59, 130, 246, 0.05)',
						boxShadow: `0 0 ${minDim * 0.05}px rgba(59, 130, 246, 0.2)`,
					}}
				>
					{/* Active Pulse to show it is active */}
					<GlowPulse color={primaryColor} speed="slow">
						<div style={{ width: reservoirSize, height: reservoirSize, borderRadius: minDim * 0.04 }} />
					</GlowPulse>

					{/* Block #1 - The Current Winner (Already inside at Frame 0) */}
					<div
						style={{
							width: blockSize,
							height: blockSize,
							background: `linear-gradient(135deg, ${primaryColor}, #1d4ed8)`,
							borderRadius: minDim * 0.02,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
							zIndex: 10,
							position: 'relative',
						}}
					>
						<span style={{ fontSize: blockSize * 0.4, fontWeight: 'bold' }}>1</span>
						
						{/* Glow effect on the block */}
						<div style={{
							position: 'absolute',
							inset: 0,
							borderRadius: minDim * 0.02,
							boxShadow: `inset 0 0 ${minDim * 0.02}px rgba(255,255,255,0.3)`
						}} />
					</div>

					{/* Label: "Current Winner" - Evolves in this scene */}
					<div
						style={{
							position: 'absolute',
							top: -height * 0.1,
							whiteSpace: 'nowrap',
							transform: `scale(${labelEntrance}) translateY(${(1 - labelEntrance) * 20}px)`,
							opacity: labelEntrance,
						}}
					>
                        <GlowPulse color={accentColor}>
                            <div style={{
                                padding: `${height * 0.01}px ${width * 0.04}px`,
                                backgroundColor: accentColor,
                                borderRadius: minDim * 0.01,
                                color: bgColor,
                                fontWeight: 'bold',
                                fontSize: height * 0.025,
                                textTransform: 'uppercase'
                            }}>
                                Current Winner
                            </div>
                        </GlowPulse>
					</div>
				</div>

				{/* The Data Stream - Moving in background (Persistent movement) */}
				<div style={{ position: 'absolute', top: streamY, width: '100%', overflow: 'visible' }}>
					{futureBlocks.map((num, i) => {
						const offset = (i + 1) * blockGap - (frame * speed) % (blockGap * 10);
						if (offset < -blockGap) return null;
						
						return (
							<div
								key={num}
								style={{
									position: 'absolute',
									left: width + offset,
									width: blockSize * 0.6,
									height: blockSize * 0.6,
									backgroundColor: 'rgba(255,255,255,0.1)',
									border: `2px solid rgba(255,255,255,0.2)`,
									borderRadius: minDim * 0.015,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: 'rgba(255,255,255,0.4)',
									fontSize: blockSize * 0.25,
								}}
							>
								{num}
							</div>
						);
					})}
				</div>
			</AbsoluteFill>

			{/* 3. Labels/Captions (Bottom 25%) */}
			<div
				style={{
					position: 'absolute',
					bottom: height * 0.1,
					width: '100%',
					padding: `0 ${width * 0.1}px`,
					boxSizing: 'border-box',
					textAlign: 'center',
				}}
			>
				<div
					style={{
						backgroundColor: 'rgba(30, 41, 59, 0.7)',
						backdropFilter: 'blur(10px)',
						padding: minDim * 0.04,
						borderRadius: minDim * 0.03,
						border: '1px solid rgba(255,255,255,0.1)',
						display: 'flex',
						flexDirection: 'column',
						gap: minDim * 0.02,
					}}
				>
					<span
						style={{
							fontSize: height * 0.028,
							color: secondaryColor,
							fontWeight: 'bold',
						}}
					>
						Constant Memory Insight
					</span>
					<span
						style={{
							fontSize: height * 0.022,
							color: 'rgba(255,255,255,0.8)',
							lineHeight: 1.4,
						}}
					>
						Regardless of the stream size, you only ever need to track the 
						<strong style={{ color: 'white' }}> current winner</strong>.
					</span>
				</div>
			</div>

			{/* Persistent n counter (representing items seen so far) */}
			<div
				style={{
					position: 'absolute',
					bottom: height * 0.03,
					right: width * 0.05,
					display: 'flex',
					alignItems: 'baseline',
					gap: 8,
				}}
			>
				<span style={{ fontSize: height * 0.02, color: 'rgba(255,255,255,0.5)' }}>Items processed (n):</span>
				<span style={{ fontSize: height * 0.035, fontWeight: 'bold', color: secondaryColor }}>1</span>
			</div>
		</AbsoluteFill>
	);
};

export default ReservoirSamplingSceneFour;