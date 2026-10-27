☁️ FinCloud – Cloud Computing in Finance

A cloud-based financial management web application developed using HTML, CSS, JavaScript, Firebase Firestore, and Firebase Hosting.

📌 Project Description

FinCloud is an academic project that demonstrates the application of cloud computing in the finance sector. It provides a web-based platform for managing income, expenses, transactions, and user information.

The application uses Firebase Firestore for cloud data storage and Firebase Hosting for online deployment. It includes administrative pages and financial management modules to help users organize and monitor financial records through a simple interface.

🎯 Objectives

- Understand the application of cloud computing in finance.
- Manage financial records through a web-based platform.
- Store and retrieve data using a cloud database.
- Track income, expenses, and transactions.
- Demonstrate cloud hosting and database integration.

🛠️ Technologies Used

| Technology | Purpose |
| HTML | Web page structure |
| CSS | Styling and layout |
| JavaScript | Application logic and interactivity |
| Firebase Firestore | Cloud database |
| Firebase Hosting | Website deployment |

✨ Features

- 📊 Financial Dashboard – View financial information and summaries.
- 👥 User Management – Manage user information through the admin module.
- 💰 Income Management – Record and review income entries.
- 💸 Expense Management – Record and review expenses.
- 💳 Transaction Management – View and manage transaction records.
- 📈 Admin Analytics – Support financial monitoring and analysis.
- 🔐 Login Page – Provide an entry point for application users.
- ☁️ Cloud Storage – Store application data using Firebase Firestore.
- 🌐 Online Access – Access the hosted website through a browser.

📂 Project Structure

fincloud/
│
├── index.html              # Main page
├── login.html              # Login page
├── admin.html              # Admin dashboard
├── admin-users.html        # User management
├── income.html             # Income management
├── expenses.html           # Expense management
├── transactions.html       # Transaction management
├── script.js               # Main JavaScript logic
├── admin-analytics.js      # Admin analytics
├── config                 # Configuration file or directory
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── firebase.json           # Firebase Hosting configuration
├── .firebaserc             # Firebase project configuration
├── DEPLOY.txt              # Deployment instructions
└── README.md               # Project documentation


☁️ Cloud Computing Integration

FinCloud uses Firebase services to demonstrate cloud-based application development.

- Cloud Database: Firebase Firestore stores and retrieves application data.
- Cloud Hosting: Firebase Hosting publishes the website online.
- Cloud Accessibility: The hosted application can be accessed through an internet-connected browser.
- Security Configuration: Firestore security rules define access permissions for database operations.

⚙️ How to Run the Project

1. Clone the Repository

git clone https://github.com/archita9131/fincloud.git
cd fincloud

2. Open the Project

Open the project folder in Visual Studio Code.

3. Configure Firebase

- Open the Firebase Console.
- Select the Firebase project associated with the application.
- Verify the Firebase configuration used by the JavaScript files.
- Ensure that Firestore is enabled and the required database collections are configured.
- Review the Firestore security rules before using the application.

4. Run Locally

Use the Visual Studio Code Live Server extension or another local web server to open the website.

5. Deploy to Firebase Hosting

Install the Firebase CLI if it is not already installed:

npm install -g firebase-tools

Sign in:

firebase login

Deploy the configured project:

firebase deploy

Follow the existing firebase.json and DEPLOY.txt configuration when deploying.

🌐 Project Links

- GitHub Repository: https://github.com/archita9131/fincloud
- Live Website: https://fincloud-30e77.web.app

🔒 Security Considerations

- Configure appropriate Firestore security rules.
- Restrict access to sensitive financial information.
- Validate user permissions before allowing database operations.
- Never commit private credentials or service-account keys to GitHub.
- Treat this project as an academic demonstration, not a production banking or payment system.

🚀 Future Enhancements

- Advanced financial analytics and visualizations.
- Exportable financial reports.
- Transaction notifications.
- Improved authentication and role-based access control.
- Additional financial reporting features.

👩‍💻 Developed By

Archita Peddamushti

Project Title: FinCloud – Cloud Computing in Finance

Project Type: Academic Web Application

Technologies: HTML, CSS, JavaScript, Firebase Firestore, Firebase Hosting
