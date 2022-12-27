require("dotenv").config();
const nodemailer = require("nodemailer");

module.exports = class Mailer {

  constructor(onlyNew = false) {
    this.onlyNew = onlyNew;
    this.transport = nodemailer.createTransport({
      service :"Gmail",
      auth: {
        user: process.env.MAILER_USER,
        pass: process.env.MAILER_PASSWORD
      }
    });
  }

  sendConfirmationEmail(email, confirmationCode) {
    this.transport.sendMail({
      from: process.env.MAILER_USER,
      to: email,
      subject: "Please confirm your account",
      html: `<h1>Email Confirmation</h1>
            <h2>Hello!</h2>
            <p>Thank you for signing up for Tracker Appr. Please confirm your email by clicking on the following link below:</p>
            <br />
            <a href="https://tracker-appr2.herokuapp.com/api/users/verify/${confirmationCode}"> Click here to verify your email</a>`
    }).catch(error => console.log(error));
  }

  sendLogsEmail(filePath, numberOfEmailsSent, numberOfResultsSent) {

    const currentDateTime = new Date().toLocaleDateString(
      "en-US",
      { month: "2-digit",
        day: "2-digit", 
        year: "numeric", 
        hour: "numeric",
        minute: "numeric" }
    );

    const htmlBody = `
    <h1>A new batch of results were sent!</h1>
    <h3>Number of emails sent: ${numberOfEmailsSent}</h3>
    <h3>Number of results sent: ${numberOfResultsSent}</h3>
    `;
    this.transport.sendMail({
      from: process.env.MAILER_USER,
      to: process.env.MAILER_USER,
      subject: `New logs are in! [${currentDateTime}]`,
      html: htmlBody,
      attachments: [{ path: filePath }]
    }, (err, info) => {
      if (err) {
        console.log(err)
      }
    });
  }

  sendResultsEmail(email, query, results, confirmationCode) {
    return new Promise((resolve, reject) => {

      if (this.onlyNew && results.every(result => !result.isNewResult)) {
        resolve(0);
        return;
      }

      const currentDateTime = new Date().toLocaleDateString(
        "en-US",
        { month: "2-digit",
          day: "2-digit", 
          year: "numeric", 
          hour: "numeric",
          minute: "numeric" }
      );

      // If onlyNew option is enabled, filter for results where isNewResult == true
      if (this.onlyNew) {
        let oldResults = results;
        results = oldResults.filter(result => result.isNewResult);
      }

      const htmlBody = this.generateEmailHtml(results, confirmationCode);
      
      this.transport.sendMail({
        from: process.env.MAILER_USER,
        to: email,
        subject: `Results are in from #${query.name}! [${currentDateTime}]`,
        html: htmlBody
      }, (err, info) => {
        if (err || info.rejected.length > 0) {
          reject();
        } else {
          console.log("Email sent successfully.");
          resolve(results.length);
        }
      });
    });
  }

  generateEmailHtml(results, confirmationCode) {
    
    const numberOfResults = results.length;
    const currentDate = new Date().toLocaleDateString(
      "en-US",
      { month: "2-digit", day: "2-digit", year: "numeric"}
    );
    const currentTime = new Date().toLocaleString(
      "en-US",
      { hour: "numeric", minute: "numeric"}
    );
    let htmlBody = 
    `<h1 style="font-size:22px;color:#2b2d42;">A total of ${numberOfResults} ${this.onlyNew ? "new " : ""}results were found that fit your query's parameters.</h1>
    <table style="border-collapse:collapse;">
      <tbody>
        <tr style="background-color:#2b2d42;color:#f4faff;font-size:18px">
          <th style="padding:4px;border:solid #2b2d42 1px;">Stock #</th>
          <th style="padding:4px;border:solid #2b2d42 1px;">Year</th>
          <th style="padding:4px;border:solid #2b2d42 1px;">Make</th>
          <th style="padding:4px;border:solid #2b2d42 1px;">Model</th>
          <th style="padding:4px;border:solid #2b2d42 1px;">Trim</th>
          <th style="padding:4px;border:solid #2b2d42 1px;">Price</th>
          <th style="padding:4px;border:solid #2b2d42 1px;">Ext. Color</th>
          <th style="padding:4px;border:solid #2b2d42 1px;">Vin #</th>
          <th style="padding:4px;border:solid #2b2d42 1px;">New Result</th>
          <th style="padding:4px;border:solid #2b2d42 1px;">Link</th>
        </tr>
        ${this.generateEmailHtmlRows(results)}
      </tbody>
      </table>
      <br />
      <p style="padding:4px;color:#2b2d42;font-size:15px;">This data was pulled on ${currentDate}, at ${currentTime}.</p>
      <p style="padding:4px;color:#2b2d42;font-size:15px;">If you no longer wish to receive alerts from Tracker Appr, <a href="http://localhost:3000/api/users/unsubscribe/${confirmationCode}" target="_blank">Unsubscribe</a></p>`
  
    return htmlBody;
  }
  
  generateEmailHtmlRows(results) {
    let bodyString = "";
    for (let result of results) {
      bodyString += 
      `<tr style="background-color:#dee7e7ff;color:#2b2d42ff;font-size:16px;text-align:center;">
        <td style="padding:4px;border:solid #2b2d42 1px;">${result.stock}</td>
        <td style="padding:4px;border:solid #2b2d42 1px;">${result.year}</td>
        <td style="padding:4px;border:solid #2b2d42 1px;">${result.make}</td>
        <td style="padding:4px;border:solid #2b2d42 1px;">${result.model}</td>
        <td style="padding:4px;border:solid #2b2d42 1px;">${result.trim}</td>
        <td style="padding:4px;border:solid #2b2d42 1px;">${result.price}</td>
        <td style="padding:4px;border:solid #2b2d42 1px;">${result.extColor}</td>
        <td style="padding:4px;border:solid #2b2d42 1px;">${result.vin}</td>
        <td style="padding:4px;border:solid #2b2d42 1px;">${result.isNewResult ? "YES" : "NO"}</td>
        <td style="padding:4px;border:solid #2b2d42 1px;"><a href=${result.link} target='_blank'>See More</a></td>
      </tr>`;
    }
    return bodyString;
  }
}

