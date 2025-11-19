
export type SourceCategory = {
  label: string;
  sources: { value: string; label: string }[];
};

export const sourceCategories: SourceCategory[] = [
  {
    label: "Digital Marketing",
    sources: [
      { value: "Website Form Submissions", label: "Website Form Submissions" },
      { value: "SEO / Organic Search", label: "SEO / Organic Search" },
      { value: "Google Ads / PPC", label: "Google Ads / PPC" },
      { value: "Facebook / Instagram Ads", label: "Facebook / Instagram Ads" },
      { value: "Social Media Organic", label: "Social Media Organic" },
      { value: "Online Directories (A Place for Mom, Caring.com, Yelp, etc.)", label: "Online Directories (A Place for Mom, Caring.com, Yelp, etc.)" },
      { value: "Email Marketing", label: "Email Marketing" },
      { value: "Online Chatbot / AI Advisor", label: "Online Chatbot / AI Advisor" },
    ],
  },
  {
    label: "Healthcare Referrals",
    sources: [
      { value: "Hospitals", label: "Hospitals" },
      { value: "Skilled Nursing Facilities (SNFs)", label: "Skilled Nursing Facilities (SNFs)" },
      { value: "Rehab Centers", label: "Rehab Centers" },
      { value: "Hospice Organizations", label: "Hospice Organizations" },
      { value: "Home Health Agencies", label: "Home Health Agencies" },
      { value: "Physicians / Clinics", label: "Physicians / Clinics" },
      { value: "Memory Care or Assisted Living Facilities", label: "Memory Care or Assisted Living Facilities" },
    ],
  },
  {
    label: "Community & Local Partnerships",
    sources: [
        { value: "Senior Centers", label: "Senior Centers" },
        { value: "Churches / Faith Community Groups", label: "Churches / Faith Community Groups" },
        { value: "Adult Day Programs", label: "Adult Day Programs" },
        { value: "Community Events / Expos", label: "Community Events / Expos" },
        { value: "Local Nonprofits", label: "Local Nonprofits" },
        { value: "Veteran Organizations (VFW, VA services)", label: "Veteran Organizations (VFW, VA services)" },
    ]
  },
  {
    label: "Personal / Relationship-based Referrals",
    sources: [
        { value: "Family Referral", label: "Family Referral" },
        { value: "Friend / Word of Mouth", label: "Friend / Word of Mouth" },
        { value: "Current Client Referral", label: "Current Client Referral" },
        { value: "Caregiver Referral", label: "Caregiver Referral" },
        { value: "Employee Referral", label: "Employee Referral" },
    ]
  },
   {
    label: "Franchise / Corporate Channels",
    sources: [
        { value: "Corporate Website Lead", label: "Corporate Website Lead" },
        { value: "Corporate Call Center", label: "Corporate Call Center" },
        { value: "Corporate Referral Partner", label: "Corporate Referral Partner" },
        { value: "National Advertising Campaigns", label: "National Advertising Campaigns" },
    ]
  },
  {
    label: "Business & Professional Networks",
    sources: [
        { value: "Elder Law Attorneys", label: "Elder Law Attorneys" },
        { value: "Financial Planners", label: "Financial Planners" },
        { value: "Long-Term Care Insurance Partners", label: "Long-Term Care Insurance Partners" },
        { value: "Hospital Discharge Planners", label: "Hospital Discharge Planners" },
        { value: "Case Managers / Social Workers", label: "Case Managers / Social Workers" },
    ]
  },
  {
    label: "Insurance & Payer Sources",
    sources: [
        { value: "Long-Term Care Insurance (LTCi)", label: "Long-Term Care Insurance (LTCi)" },
        { value: "Workers’ Comp", label: "Workers’ Comp" },
        { value: "VA Benefits (Aid & Attendance)", label: "VA Benefits (Aid & Attendance)" },
        { value: "Private Insurance Partners", label: "Private Insurance Partners" },
    ]
  },
  {
    label: "Traditional Marketing",
    sources: [
        { value: "Print Ads", label: "Print Ads" },
        { value: "Local Newspapers", label: "Local Newspapers" },
        { value: "Direct Mail", label: "Direct Mail" },
        { value: "Radio / TV", label: "Radio / TV" },
        { value: "Billboards", label: "Billboards" },
        { value: "Flyers / Brochures", label: "Flyers / Brochures" },
    ]
  },
  {
    label: "Walk-ins & Local Visibility",
    sources: [
        { value: "Walk-In / Office Visit", label: "Walk-In / Office Visit" },
        { value: "Community Outreach", label: "Community Outreach" },
        { value: "Vehicle Wrap Branding Lead", label: "Vehicle Wrap Branding Lead" },
    ]
  },
  {
    label: "Other / Internal",
    sources: [
        { value: "Previous Client Re-engagement", label: "Previous Client Re-engagement" },
        { value: "Respite Program Inquiry", label: "Respite Program Inquiry" },
        { value: "General Inquiry (Uncategorized)", label: "General Inquiry (Uncategorized)" },
    ]
  }
];

export const allSources = sourceCategories.flatMap(category => category.sources);
