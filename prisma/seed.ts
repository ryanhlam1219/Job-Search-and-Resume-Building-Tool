import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const DEMO_USER_ID = "demo-user-1";

const sampleJobs = [
  {
    title: "Senior Frontend Engineer",
    company: "Stripe",
    description: `We are looking for a Senior Frontend Engineer to join our team.\n\nYou will:\n- Build and maintain high-quality React applications\n- Collaborate with design and backend teams\n- Mentor junior engineers\n- Drive frontend architecture decisions\n\nRequirements:\n- 5+ years of React/TypeScript experience\n- Strong understanding of web performance\n- Experience with state management (Redux, Zustand)\n- Knowledge of testing frameworks`,
    location: "San Francisco, CA (Hybrid)",
    salary: "$180,000 - $240,000 USD",
    source: "linkedin",
    url: "https://stripe.com/jobs/senior-frontend-engineer",
  },
  {
    title: "Full Stack Engineer",
    company: "Vercel",
    description: `Join Vercel to help build the future of web development.\n\nYou will:\n- Work on Next.js and related infrastructure\n- Build developer tools used by millions\n- Collaborate with open source community\n\nRequirements:\n- Strong JavaScript/TypeScript skills\n- Experience with Node.js and React\n- Understanding of edge computing\n- Passion for developer experience`,
    location: "Remote",
    salary: "$160,000 - $210,000 USD",
    source: "indeed",
    url: "https://vercel.com/careers/full-stack-engineer",
  },
  {
    title: "Software Engineer II",
    company: "Airbnb",
    description: `Airbnb is seeking a Software Engineer to work on our booking infrastructure.\n\nResponsibilities:\n- Design and implement scalable backend services\n- Work with distributed systems at scale\n- Collaborate cross-functionally with product teams\n\nQualifications:\n- 3+ years software engineering experience\n- Proficiency in Python or Java\n- Experience with microservices architecture\n- Strong problem-solving skills`,
    location: "San Francisco, CA",
    salary: "$170,000 - $220,000 USD",
    source: "glassdoor",
    url: "https://careers.airbnb.com/software-engineer-2",
  },
  {
    title: "Machine Learning Engineer",
    company: "OpenAI",
    description: `OpenAI is looking for ML engineers to advance our AI capabilities.\n\nYou will:\n- Train and deploy large language models\n- Research novel ML architectures\n- Build infrastructure for AI systems\n- Collaborate with world-class researchers\n\nRequirements:\n- Strong ML/DL foundations\n- Experience with PyTorch\n- Knowledge of transformer architectures\n- Python proficiency`,
    location: "San Francisco, CA",
    salary: "$200,000 - $350,000 USD",
    source: "linkedin",
    url: "https://openai.com/careers/ml-engineer",
  },
  {
    title: "Backend Engineer - Platform",
    company: "Figma",
    description: `Figma is hiring a Backend Engineer to work on our collaboration platform.\n\nYou will:\n- Scale real-time collaboration infrastructure\n- Build APIs used by millions of designers\n- Improve performance and reliability\n\nRequirements:\n- 4+ years backend experience\n- Experience with Rust, Go, or C++\n- Understanding of distributed systems\n- PostgreSQL and Redis experience`,
    location: "New York, NY (Hybrid)",
    salary: "$165,000 - $215,000 USD",
    source: "indeed",
    url: "https://figma.com/careers/backend-engineer",
  },
  {
    title: "DevOps Engineer",
    company: "Datadog",
    description: `Datadog is seeking a DevOps Engineer to join our infrastructure team.\n\nResponsibilities:\n- Manage Kubernetes clusters at scale\n- Build CI/CD pipelines\n- Monitor and improve system reliability\n- Automate infrastructure provisioning\n\nRequirements:\n- 3+ years DevOps/SRE experience\n- Kubernetes and Terraform expertise\n- AWS or GCP experience\n- Strong scripting skills (Python/Bash)`,
    location: "Remote",
    salary: "$145,000 - $195,000 USD",
    source: "glassdoor",
    url: "https://datadoghq.com/careers/devops",
  },
];

const sampleResume = {
  name: "Alex Johnson",
  title: "Senior Software Engineer",
  email: "alex.johnson@example.com",
  phone: "+1 (415) 555-0100",
  location: "San Francisco, CA",
  linkedin: "linkedin.com/in/alexjohnson",
  summary: "Full-stack engineer with 6 years building scalable web applications. Passionate about developer experience and clean architecture.",
  experience: [
    {
      company: "TechCorp Inc.",
      role: "Senior Software Engineer",
      startDate: "Jan 2022",
      endDate: "Present",
      bullets: [
        "Led migration of monolith to microservices, reducing deployment time by 60%",
        "Built real-time dashboard serving 50K daily active users using React and WebSockets",
        "Mentored 3 junior engineers and established code review best practices",
      ],
    },
    {
      company: "StartupXYZ",
      role: "Software Engineer",
      startDate: "Jun 2020",
      endDate: "Dec 2021",
      bullets: [
        "Developed REST APIs with Node.js handling 1M+ requests per day",
        "Reduced database query time by 40% through indexing and query optimization",
        "Implemented CI/CD pipeline reducing manual deployment errors by 80%",
      ],
    },
    {
      company: "Digital Agency",
      role: "Junior Developer",
      startDate: "Aug 2018",
      endDate: "May 2020",
      bullets: [
        "Built 15+ client websites using React and Next.js",
        "Integrated payment systems processing $500K monthly transactions",
      ],
    },
  ],
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Redis", "AWS", "Docker", "Kubernetes", "GraphQL", "Python", "Git", "Agile"],
  education: [
    {
      institution: "UC Berkeley",
      degree: "B.S. Computer Science",
      year: "2018",
    },
  ],
};

async function main() {
  console.log("Seeding database...");

  // Create demo user
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    create: { id: DEMO_USER_ID, email: "demo@jobassistant.ai", name: "Demo User" },
    update: {},
  });

  // Create sample jobs
  for (const job of sampleJobs) {
    await prisma.job.upsert({
      where: { url: job.url },
      create: job,
      update: {},
    });
  }

  // Create sample resume
  const existingResume = await prisma.resume.findFirst({
    where: { userId: DEMO_USER_ID },
  });

  if (!existingResume) {
    await prisma.resume.create({
      data: {
        userId: DEMO_USER_ID,
        name: sampleResume.name,
        title: sampleResume.title,
        data: sampleResume,
      },
    });
  }

  console.log(`✓ Created demo user`);
  console.log(`✓ Created ${sampleJobs.length} sample jobs`);
  console.log(`✓ Created sample resume for ${sampleResume.name}`);
  console.log("\nSeed complete! Run: npm run dev");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
