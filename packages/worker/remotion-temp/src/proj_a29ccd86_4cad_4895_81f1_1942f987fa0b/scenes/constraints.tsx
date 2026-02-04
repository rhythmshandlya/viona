import React from 'react';
import {
	AbsoluteFill,
	useVideoConfig,
	useCurrentFrame,
	interpolate,
	spring,
} from 'remotion';
import {
	FadeIn,
	GlowPulse,
	PremiumStagger,
	PopIn,
	BounceIn,
} from '../../animations';

const ReservoirSamplingSceneTwo: React.FC = () => {
	const { width, height, fps } = useVideoConfig();
	const frame = useCurrentFrame();
	const minDim = Math.min(width, height);

	// Constants
	const blockSize = minDim * 0.15;
	const blockGap = minDim * 0.05;
	const streamY = height * 0.5;
	const reservoirX = width * 0.5;

	// Ongoing stream motion (persistent from previous scene)
	// Speed: 4 blocks per second (120px per second approx)
	const speed = (blockSize + blockGap) * 4 / fps;
	const streamOffset = (frame * speed) % (blockSize + blockGap);

	// Evolution: Camera pan and fog expansion
	const panProgress = spring({
		frame: frame - 30,
		fps,
		config: { damping: 15, stiffness: 60 },
	});
	
	const cameraX = interpolate(panProgress, [0, 1], [0, -width * 0.2]);
	const fogIntensity = interpolate(frame, [60, 180], [0, 1], {
		extrapolateRight: 'clamp',
	});

	// Data blocks to render in the stream
	const blocks = Array.from({ length: 12 }).map((_, i) => ({
		id: 100 + i - Math.floor(frame * 4 / fps),
	}));

	return (
		<AbsoluteFill style={{ backgroundColor: '#0F172A', overflow: 'hidden' }}>
			{/* Persistent Header */}
			<AbsoluteFill style={{ height: height * 0.15, top: height * 0.05 }}>
				<FadeIn>
					<h1
						style={{
							color: 'white',
							fontSize: minDim * 0.06,
							textAlign: 'center',
							fontFamily: 'sans-serif',
							fontWeight: 800,
							margin: 0,
						}}
					>
						UNBOUNDED DATA STREAM
					</h1>
				</FadeIn>
			</AbsoluteFill>

			{/* Main Visual Area */}
			<div
				style={{
					position: 'absolute',
					width: '100%',
					height: '100%',
					transform: `translateX(${cameraX}px)`,
				}}
			>
				{/* The Reservoir (Persistent Container) */}
				<div
					style={{
						position: 'absolute',
						left: reservoirX - (blockSize * 1.2) / 2,
						top: streamY - (blockSize * 1.2) / 2,
						width: blockSize * 1.2,
						height: blockSize * 1.2,
						border: `${minDim * 0.008}px solid #3B82F6`,
						borderRadius: minDim * 0.02,
						boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
						zIndex: 5,
					}}
				/>

				{/* The Moving Stream */}
				{blocks.map((block, i) => {
					const xPos = (i * (blockSize + blockGap)) - streamOffset;
					return (
						<div
							key={block.id}
							style={{
								position: 'absolute',
								left: xPos,
								top: streamY - blockSize / 2,
								width: blockSize,
								height: blockSize,
								background: 'linear-gradient(135deg, #1E293B, #334155)',
								borderRadius: minDim * 0.015,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: '#94A3B8',
								fontSize: blockSize * 0.3,
								border: '1px solid rgba(255,255,255,0.1)',
								opacity: interpolate(xPos, [width * 0.7, width * 0.9], [1, 0], { extrapolateLeft: 'clamp' }),
							}}
						>
							#{block.id}
						</div>
					);
				})}

				{/* The "Infinity" Fog Zone */}
				<div
					style={{
						position: 'absolute',
						right: -width * 0.2,
						top: 0,
						bottom: 0,
						width: width * 0.6,
						background: 'linear-gradient(to right, transparent, #0F172A 80%)',
						opacity: fogIntensity,
						zIndex: 10,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<div style={{ transform: `scale(${interpolate(fogIntensity, [0, 1], [0.5, 1.2])})` }}>
						<GlowPulse color="#F59E0B">
							<svg viewBox="0 0 24 24" width={minDim * 0.3} height={minDim * 0.3} fill="#F59E0B">
								<path d="M18.18 8.05c-1.12 0-2.18.42-2.98 1.19l-3.2 3.08-3.2-3.08c-.8-.77-1.87-1.19-2.99-1.19-2.31 0-4.19 1.88-4.19 4.19s1.88 4.19 4.19 4.19c1.12 0 2.19-.42 2.99-1.19l3.2-3.08 3.2 3.08c.8.77 1.87 1.19 2.99 1.19 2.31 0 4.19-1.88 4.19-4.19s-1.88-4.19-4.19-4.19zm-13.37 6.38c-.59 0-1.13-.23-1.53-.63-.4-.4-.63-.94-.63-1.53s.23-1.13.63-1.53c.4-.4.94-.63 1.53-.63s1.13.23 1.53.63l2.25 2.16-2.25 2.16c-.4.4-.94.63-1.53.63zm13.37 0c-.59 0-1.13-.23-1.53-.63l-2.25-2.16 2.25-2.16c.4-.4.94-.63 1.53-.63s1.13.23 1.53.63c.4.4.63.94.63 1.53s-.23 1.13-.63 1.53c-.4.4-.94.63-1.53.63z"/>
							</svg>
						</GlowPulse>
					</div>
				</div>
			</div>

			{/* RAM Limit Indicator (Persistent but fading out) */}
			<div
				style={{
					position: 'absolute',
					top: height * 0.25,
					right: width * 0.1,
					opacity: interpolate(frame, [0, 60], [1, 0.2]),
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: minDim * 0.02,
				}}
			>
				<div style={{ position: 'relative' }}>
					<svg width={minDim * 0.15} height={minDim * 0.15} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
						<rect x="2" y="5" width="20" height="14" rx="2" />
						<path d="M6 5v2M10 5v2M14 5v2M18 5v2" />
					</svg>
					<div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						<span style={{ color: '#EF4444', fontSize: minDim * 0.12, fontWeight: 900 }}>✕</span>
					</div>
				</div>
				<span style={{ color: '#64748B', fontSize: minDim * 0.03 }}>Limited RAM</span>
			</div>

			{/* Lower Info Area: The "Unknown N" Problem */}
			<AbsoluteFill style={{ top: height * 0.75, height: height * 0.2 }}>
				<div
					style={{
						display: 'flex',
						flexDirection: 'row',
						justifyContent: 'center',
						alignItems: 'center',
						gap: minDim * 0.1,
					}}
				>
					<PremiumStagger speed="fast">
						<div style={{ textAlign: 'center' }}>
							<div style={{ color: '#94A3B8', fontSize: minDim * 0.04 }}>Current Item Seen</div>
							<div style={{ color: '#F59E0B', fontSize: minDim * 0.08, fontWeight: 'bold' }}>
								n = {1000 + Math.floor(frame / 2)}
							</div>
						</div>

						<div style={{ textAlign: 'center' }}>
							<div style={{ color: '#94A3B8', fontSize: minDim * 0.04 }}>Total Stream Size</div>
							<div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
								<div 
									style={{ 
										color: '#64748B', 
										fontSize: minDim * 0.08, 
										fontWeight: 'bold',
										opacity: interpolate(frame, [90, 120], [1, 0.3])
									}}
								>
									N = ???
								</div>
								
								{frame > 110 && (
									<div style={{ position: 'absolute', top: -minDim * 0.02 }}>
										<BounceIn delay={120}>
											<span style={{ fontSize: minDim * 0.1, color: '#F59E0B', fontWeight: 900 }}>?</span>
										</BounceIn>
									</div>
								)}
							</div>
						</div>
					</PremiumStagger>
				</div>
			</AbsoluteFill>

			{/* Caption Label */}
			<AbsoluteFill style={{ top: 'unset', bottom: height * 0.05, height: 'auto' }}>
				<PopIn delay={40}>
					<div
						style={{
							margin: '0 auto',
							padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
							backgroundColor: 'rgba(30, 41, 59, 0.8)',
							border: '1px solid #3B82F6',
							borderRadius: minDim * 0.05,
							backdropFilter: 'blur(10px)',
							color: 'white',
							fontSize: minDim * 0.035,
							textAlign: 'center',
							maxWidth: '80%',
						}}
					>
						Problem: Total stream size (N) is unknown until it ends.
					</div>
				</PopIn>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export default ReservoirSamplingSceneTwo;