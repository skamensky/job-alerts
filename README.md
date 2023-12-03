# AI-Powered Job Alerts System

## Overview
The "AI-Powered Job Alerts System" is a typeScript-based application designed to automate the discovery and notification of job opportunities. Utilizing technologies like WhatsApp API, AWS services, and OpenAI's GPT models, this system scans job postings, evaluates their relevance to user profiles, and sends personalized alerts. It's an ideal solution for users looking to streamline their job search with the latest in AI and cloud technologies.

## Key Features
- **WhatsApp API Integration**: Efficiently scans and processes WhatsApp chats for job postings in groups you specify
- **OpenAI GPT Integration**: Leverages GPT models to analyze job posts for relevance based on user-defined criteria such as skills and career goals.
- **AWS Services Integration**:
  - **S3**: Robustly manages state storage for application continuity.
  - **SES**: Sends customized email alerts for job postings.
  - **SQS**: Effectively queues job posts for processing.
- **Customizable Email Alerts**: Personalizes job alerts with detailed matching reasons.
- **Error Handling**: Efficiently manages errors like throttling and queue failures.
- **Terraform Integration**: Utilizes Infrastructure as Code (IaC) for efficient AWS resource management, including SQS queues, S3 buckets, and IAM policies.
- **Automated Deployment**: Features a `run.sh` script for easy initialization and application of Terraform configurations, streamlining the deployment process.

## Installation & Setup
1. Clone the repository.
2. Ensure Node.js and TypeScript are installed.
3. Install dependencies: `npm install`.
4. Set up AWS credentials; ensure Terraform is installed for resource management.
5. Run `run.sh` to initialize and apply the Terraform configuration.
5. Create a `.env` file with the environment variables below


### Environment variables
* `OPENAI_API_KEY`
* `OPENAI_MODEL`
* `AWS_ACCESS_KEY_ID`
* `AWS_ACCOUNT_ID`
* `AWS_BUCKET_NAME`
* `AWS_REGION`
* `AWS_SECRET_ACCESS_KEY`
* `AWS_SQS_QUEUE_NAME`
* `WHATSAPP_CHATS_TO_SCAN` (comma-separated list of WhatsApp group ids to scan, group ids can be interrogated from the WhatsApp API)

assets/careerGoals.txt assets/careerNonGoals.txt assets/companyStyle.txt assets/contactInfo.txt assets/emailTemplate.txt assets/experience.txt assets/jobPosts.txt assets/prompt.txt assets/skills.txt assets/toEmail.txt


## Usage
1. Configure the `.env` file with the specified environment variables.
2. Change all of the information in the assets folder to match your own. Content you need to write:
    - `careerGoals.txt` (What are your career goals?)
    - `careerNonGoals.txt` (What are your career non-goals?)
    - `companyStyle.txt` (What kind of company do you want to work for?)
    - `emailTemplate.txt` (Body of email for job alerts, I recommend using the default template)
    - `experience.txt` (What is your experience?)
    - `prompt.txt` (I recommend using the default prompt)
    - `skills.txt` (What are your skills?)
    - `toEmail.txt` (What email address do you want to send job alerts to?)
3. Execute the application: `npm run start`
4. If this is your first time running the application, you will need to authenticate with the WhatsApp API. Scan the QR code that appears in the terminal.
5. The system starts scanning WhatsApp messages and processing job posts.

## Contributing
If you are interested in using this project and it's not working for you, or you have some specific needs that this project doesn't address, please open an issue. I'm happy to help you get it working or consider adding the features you need. 

## License
This project is licensed under the MIT License - see the LICENSE.txt file for details

## About the project


This was a fun weekend project!

I realized I wasn't reading all the job postings in my WhatsApp groups because:

1. Most were irrelevant to me
2. Most were written in Hebrew (I live in Israel), so it took me time and context switching to read them



So I decided to build a system that would do it for me and only present the relevant posts, in English. I also wanted to get more hands on experience with how to leverage OpenAI's GPT models for decision making, so I decided to integrate them into the system. 

### Me
My expertise lies in integrating complex systems to deliver seamless and efficient user experiences by crafting innovative solutions. Contact me for consulting services or collaboration on advanced tech projects.