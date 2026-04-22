export interface FAQ {
  question: string;
  answer: string;
}

export const pricingFaqs: FAQ[] = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes. You can upgrade or downgrade your plan at any time from your account settings. When upgrading, you will be charged the prorated difference for the remainder of your billing cycle. When downgrading, the new rate takes effect at the start of your next billing period, and you keep access to your current plan features until then.",
  },
  {
    question: "What happens if I exceed my monthly video limit?",
    answer:
      "On the Starter plan, you will not be able to process additional videos until the next month. On the Pro plan, you can purchase additional video credits as needed. Enterprise customers have unlimited video processing included in their agreement.",
  },
  {
    question: "Is there a free trial for the Pro plan?",
    answer:
      "Yes. The Pro plan includes a 14-day free trial with full access to all Pro features. No credit card is required to start the trial. If you decide not to continue, your account will automatically revert to the Starter plan at the end of the trial period.",
  },
  {
    question: "What video formats and lengths are supported?",
    answer:
      "Viona supports all common video formats including MP4, MOV, and WebM. There is no strict length limit, but processing time increases with video duration. Most users upload videos between 2 and 30 minutes. For very long recordings, we recommend splitting them into shorter segments for the best results.",
  },
  {
    question: "Do you offer annual billing?",
    answer:
      "Yes. Annual billing is available for the Pro plan at a discounted rate. Contact us for details on annual pricing and any active promotions. Enterprise agreements are also available on an annual basis with custom terms.",
  },
];
