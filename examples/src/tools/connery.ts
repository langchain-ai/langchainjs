import { ConneryService } from "langchain/tools/connery";

const conneryService = new ConneryService();
const sendEmailAction = await conneryService.getAction(
  "CABC80BB79C15067CA983495324AE709"
);

const result = await sendEmailAction.call(
  "Send an email to test@example.com with the subject 'Test email' and the body 'This is a test email sent from Connery.'"
);

console.log(result);
