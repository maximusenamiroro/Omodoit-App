import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme';

// The app's interface icons.
//
// WHY THIS EXISTS
// There were three icon systems running at once. The Reels tab and the
// Flash bolt were drawn from view borders, so they were identical on
// both platforms. The other tabs were text characters (◎ ◯ ● ▣), and
// the call controls and most headers were emoji. Roughly seventy-six
// emoji were doing the job of icons.
//
// Text glyphs and emoji are drawn by whichever font the platform picks,
// so their weight, size and even shape differ between Android and iOS,
// and they cannot take the colour of the thing they sit in. That is the
// same problem the pause button had. Vectors are identical everywhere
// and inherit colour and size from their caller.
//
// Emoji is deliberately left where it is genuinely illustration rather
// than control: the category tiles, the empty states, the celebration
// in a success alert. Those read as pictures, not buttons.
//
// All paths are drawn on a 24x24 grid with a 2pt stroke, so anything
// added later lines up without adjustment.

export type IconName =
  | 'reels' | 'explore' | 'inbox' | 'profile' | 'station'
  | 'mic' | 'micOff' | 'speaker' | 'speakerOff' | 'callEnd'
  | 'bell' | 'search' | 'settings' | 'orders' | 'bank' | 'back'
  | 'bookings' | 'saved' | 'edit' | 'star';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  /** Fills the shape instead of stroking it. Used for active tabs. */
  filled?: boolean;
}

export default function Icon({ name, size = 24, color = colors.textPrimary, filled }: Props) {
  const stroke = color;
  const common = {
    stroke,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'reels' && (
        <>
          <Rect x={3} y={4} width={18} height={16} rx={3} {...common} />
          <Path d="M10 9.5v5l4.5-2.5z" {...common} fill={filled ? stroke : 'none'} />
        </>
      )}

      {name === 'explore' && (
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Path d="M15.5 8.5l-2 5-5 2 2-5z" {...common} fill={filled ? stroke : 'none'} />
        </>
      )}

      {name === 'inbox' && (
        <Path d="M4 6h16v10a2 2 0 0 1-2 2H9l-5 3z" {...common} fill={filled ? stroke : 'none'} />
      )}

      {name === 'profile' && (
        <>
          <Circle cx={12} cy={8} r={4} {...common} fill={filled ? stroke : 'none'} />
          <Path d="M4.5 20a7.5 7.5 0 0 1 15 0" {...common} />
        </>
      )}

      {name === 'station' && (
        <>
          <Rect x={3} y={3} width={7.5} height={7.5} rx={2} {...common} />
          <Rect x={13.5} y={3} width={7.5} height={7.5} rx={2} {...common} />
          <Rect x={3} y={13.5} width={7.5} height={7.5} rx={2} {...common} />
          <Rect x={13.5} y={13.5} width={7.5} height={7.5} rx={2} {...common} />
        </>
      )}

      {name === 'mic' && (
        <>
          <Rect x={9} y={2.5} width={6} height={11} rx={3} {...common} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...common} />
        </>
      )}

      {name === 'micOff' && (
        <>
          <Rect x={9} y={2.5} width={6} height={11} rx={3} {...common} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M4 3l16 18" {...common} />
        </>
      )}

      {name === 'speaker' && (
        <>
          <Path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" {...common} />
          <Path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" {...common} />
        </>
      )}

      {name === 'speakerOff' && (
        <>
          <Path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" {...common} />
          <Path d="M16.5 9.5l5 5M21.5 9.5l-5 5" {...common} />
        </>
      )}

      {name === 'callEnd' && (
        <Path
          d="M3 13.5c5-4.5 13-4.5 18 0l-2 2.5-3.5-1v-2.5a12 12 0 0 0-7 0V15l-3.5 1z"
          {...common}
          fill={filled ? stroke : 'none'}
        />
      )}

      {name === 'bell' && (
        <>
          <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" {...common} fill={filled ? stroke : 'none'} />
          <Path d="M10 19a2.2 2.2 0 0 0 4 0" {...common} />
        </>
      )}

      {name === 'search' && (
        <>
          <Circle cx={10.5} cy={10.5} r={6.5} {...common} />
          <Path d="M15.5 15.5L21 21" {...common} />
        </>
      )}

      {name === 'settings' && (
        <>
          <Circle cx={12} cy={12} r={3.2} {...common} />
          <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" {...common} />
        </>
      )}

      {name === 'orders' && (
        <>
          <Rect x={5} y={4} width={14} height={17} rx={2.5} {...common} />
          <Path d="M9 3.5h6v3H9zM9 11h6M9 15h4" {...common} />
        </>
      )}

      {name === 'bank' && (
        <Path d="M3.5 9.5L12 4.5l8.5 5M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3 20.5h18" {...common} />
      )}

      {name === 'back' && <Path d="M15 4.5L7.5 12l7.5 7.5" {...common} />}

      {/* Clipboard: a booking is a job written down and agreed. */}
      {name === 'bookings' && (
        <>
          <Path d="M9 4h6v2.5H9z" {...common} fill={filled ? stroke : 'none'} />
          <Path d="M8 4H6.5A1.5 1.5 0 005 5.5v13A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0017.5 4H16" {...common} />
          <Path d="M8.5 11.5h7M8.5 15h4.5" {...common} />
        </>
      )}

      {/* Bookmark rather than a tag: saved means kept for later. */}
      {name === 'saved' && (
        <Path d="M6.5 4.5h11v15l-5.5-4-5.5 4z" {...common} fill={filled ? stroke : 'none'} />
      )}

      {/* Reviews are stars everywhere else in the app, so the tab is a
          star rather than something cleverer. */}
      {name === 'star' && (
        <Path d="M12 4.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 16.48l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76z"
              {...common} fill={filled ? stroke : 'none'} />
      )}

      {name === 'edit' && (
        <>
          <Path d="M4.5 19.5h4l9.5-9.5a2.1 2.1 0 00-3-3L5.5 16.5z" {...common} />
          <Path d="M14 6.5l3.5 3.5" {...common} />
        </>
      )}
    </Svg>
  );
}
