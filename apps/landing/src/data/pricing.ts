export interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out Cllipify",
    features: [
      "5 videos per month",
      "720p export quality",
      "Basic templates",
      "Community support",
      "Cllipify watermark",
    ],
    cta: "Start Free",
  },
  {
    name: "Pro",
    price: "$29",
    period: "per month",
    description: "For creators who need more power",
    features: [
      "50 videos per month",
      "4K export quality",
      "Premium templates",
      "Priority support",
      "No watermark",
      "Custom branding",
      "Team collaboration",
    ],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    description: "For large teams and agencies",
    features: [
      "Unlimited videos",
      "4K+ export quality",
      "Custom templates",
      "Dedicated support",
      "API access",
      "SSO & security",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
  },
];
