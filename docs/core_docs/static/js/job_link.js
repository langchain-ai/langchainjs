document.addEventListener("DOMContentLoaded", function() {
  const jobLink = document.getElementById("js_job_link");
  if (jobLink) {
    const jobUrl = new URL(jobLink.href);
    const pageLocation = new URL(document.location.href);
    pageLocation.search = "";
    jobUrl.searchParams.set("utm_source", pageLocation.toString());
    jobUrl.searchParams.set("utm_campaign", "langchainjs_docs");
    jobLink.href = jobUrl.toString();
  }
});
