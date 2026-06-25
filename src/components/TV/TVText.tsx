import { memo, type PropsWithChildren } from 'react'
import { Text, type TextProps, type TextStyle } from 'react-native'
import { tvColors, tvTokens } from '@/theme/tv'

interface Props extends TextProps {
  variant?: 'brand' | 'pageTitle' | 'sectionTitle' | 'cardTitle' | 'body' | 'caption' | 'meta'
  color?: string
}

const variants: Record<NonNullable<Props['variant']>, TextStyle> = {
  brand: {
    color: tvColors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  pageTitle: {
    color: tvColors.text,
    fontSize: tvTokens.title,
    fontWeight: '900',
  },
  sectionTitle: {
    color: tvColors.text,
    fontSize: tvTokens.railTitle,
    fontWeight: '800',
  },
  cardTitle: {
    color: tvColors.text,
    fontSize: tvTokens.cardTitle,
    fontWeight: '800',
  },
  body: {
    color: tvColors.text,
    fontSize: tvTokens.body,
  },
  caption: {
    color: tvColors.subtext,
    fontSize: tvTokens.caption,
  },
  meta: {
    color: tvColors.subtext,
    fontSize: 15,
  },
}

const TVText = ({ variant = 'body', color, style, children, ...props }: PropsWithChildren<Props>) => (
  <Text
    style={[
      variants[variant],
      color ? { color } : null,
      style,
    ]}
    {...props}
  >
    {children}
  </Text>
)

export default memo(TVText)
