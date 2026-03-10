import React from 'react';

interface PostcardFrameProps {
  width: number;
  height: number;
  borderStyle: 'classic' | 'modern' | 'ornate';
  backgroundColor: string;
  borderColor: string;
  accentColor: string;
  greeting: string;
  destinationName: string;
  headlineFont: string;
  bodyFont: string;
  textColor: string;
  greetingOpacity: number;
  destinationOpacity: number;
  borderOpacity: number;
  greetingTranslateY: number;
  destinationTranslateY: number;
  children?: React.ReactNode;
}

/** Corner flourish SVG for ornate border style */
const CornerFlourish: React.FC<{
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
}> = ({ x, y, rotation, color, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 60 60"
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `rotate(${rotation}deg)`,
      transformOrigin: 'center',
    }}
  >
    <path
      d="M 5 5 Q 5 30 30 30 Q 5 30 5 55"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    <path
      d="M 8 5 Q 8 27 30 27"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      opacity={0.6}
    />
  </svg>
);

const PostcardFrame: React.FC<PostcardFrameProps> = ({
  width,
  height,
  borderStyle,
  backgroundColor,
  borderColor,
  accentColor,
  greeting,
  destinationName,
  headlineFont,
  bodyFont,
  textColor,
  greetingOpacity,
  destinationOpacity,
  borderOpacity,
  greetingTranslateY,
  destinationTranslateY,
  children,
}) => {
  const margin = 40;
  const flourishSize = 60;

  const renderBorder = () => {
    switch (borderStyle) {
      case 'classic':
        return (
          <>
            {/* Outer line */}
            <div
              style={{
                position: 'absolute',
                inset: margin,
                border: `3px solid ${borderColor}`,
                opacity: borderOpacity,
              }}
            />
            {/* Inner line */}
            <div
              style={{
                position: 'absolute',
                top: margin + 8,
                left: margin + 8,
                right: margin + 8,
                bottom: margin + 8,
                border: `1px solid ${borderColor}`,
                opacity: borderOpacity * 0.6,
              }}
            />
          </>
        );

      case 'modern':
        return (
          <div
            style={{
              position: 'absolute',
              inset: margin,
              border: `2px solid ${borderColor}`,
              borderRadius: 16,
              opacity: borderOpacity,
            }}
          />
        );

      case 'ornate':
        return (
          <>
            <div
              style={{
                position: 'absolute',
                inset: margin,
                border: `4px solid ${borderColor}`,
                opacity: borderOpacity,
              }}
            />
            {/* Corner flourishes */}
            <div style={{ opacity: borderOpacity }}>
              <CornerFlourish
                x={margin - 10}
                y={margin - 10}
                rotation={0}
                color={accentColor}
                size={flourishSize}
              />
              <CornerFlourish
                x={width - margin - flourishSize + 10}
                y={margin - 10}
                rotation={90}
                color={accentColor}
                size={flourishSize}
              />
              <CornerFlourish
                x={margin - 10}
                y={height - margin - flourishSize + 10}
                rotation={270}
                color={accentColor}
                size={flourishSize}
              />
              <CornerFlourish
                x={width - margin - flourishSize + 10}
                y={height - margin - flourishSize + 10}
                rotation={180}
                color={accentColor}
                size={flourishSize}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        backgroundColor,
      }}
    >
      {renderBorder()}

      {/* Text area - centered in the card */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: margin + 40,
          right: margin + 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Greeting line */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 36,
            fontStyle: 'italic',
            color: textColor,
            opacity: greetingOpacity,
            transform: `translateY(${greetingTranslateY}px)`,
            letterSpacing: 2,
            marginBottom: 12,
          }}
        >
          {greeting}
        </div>

        {/* Destination name */}
        <div
          style={{
            fontFamily: headlineFont,
            fontSize: 72,
            fontWeight: 700,
            color: textColor,
            opacity: destinationOpacity,
            transform: `translateY(${destinationTranslateY}px)`,
            letterSpacing: 3,
            lineHeight: 1.1,
          }}
        >
          {destinationName}
        </div>

        {/* Decorative divider */}
        <div
          style={{
            width: 120,
            height: 2,
            backgroundColor: accentColor,
            marginTop: 24,
            opacity: destinationOpacity * 0.8,
            transform: `translateY(${destinationTranslateY}px)`,
          }}
        />
      </div>

      {/* Slot for stamp and postmark */}
      {children}
    </div>
  );
};

export default PostcardFrame;
