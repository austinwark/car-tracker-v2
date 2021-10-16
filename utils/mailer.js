require("dotenv").config();
const nodemailer = require("nodemailer");

module.exports = class Mailer {

  constructor() {
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
            <a href="http://localhost:3000/api/users/verify/${confirmationCode}"> Click here to verify your email</a>`
    }).catch(error => console.log(error));
  }

  sendResultsEmail(email, query, results) {
    const htmlBody = this.generateEmailHtml(results);
    this.transport.sendMail({
      from: process.env.MAILER_USER,
      to: email,
      subject: `Results are in from #${query.name}!`,
      html: htmlBody
    }).catch(err => console.log(err));;
  }

  generateEmailHtml(results) {
    const numberOfResults = results.length;
  
    let htmlBody = 
    `<h1 style="font-size:22px;color:#2b2d42;">A total of ${numberOfResults} results were found that fit your query's parameters.</h1>
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
          <th style="padding:4px;border:solid #2b2d42 1px;">Link</th>
        </tr>
        ${this.generateEmailHtmlRows(results)}
      </tbody>
      </table>`
  
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
        <td style="padding:4px;border:solid #2b2d42 1px;"><a href=${result.link} target='_blank'>See More</a></td>
      </tr>`;
    }
    return bodyString;
  }
}

